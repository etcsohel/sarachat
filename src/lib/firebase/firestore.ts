
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
  Timestamp,
  onSnapshot, 
  deleteDoc, // Import deleteDoc
} from "firebase/firestore";
import { db, auth } from "./firebase"; // Assuming auth is exported for current user UID
import type { UserProfile, Chat, ChatMessage, DecryptedChatMessage } from "@/types";
import type { User as FirebaseUser } from "firebase/auth";
import { encryptMessage, decryptMessage } from "@/lib/crypto"; 

// Users Collection
export async function createUserProfile(
  user: FirebaseUser, 
  publicKey?: JsonWebKey, 
  displayName?: string
): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: displayName || user.displayName,
    photoURL: user.photoURL,
    publicKey: publicKey,
    createdAt: Date.now(),
  };
  await setDoc(userRef, profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, data);
}

export async function searchUsers(searchTerm: string, currentUserId: string): Promise<UserProfile[]> {
  if (!searchTerm.trim()) return [];
  const usersRef = collection(db, "users");
  // Query for an exact match on the email. An index on 'email' is recommended by Firebase for performance.
  const q = query(
    usersRef, 
    where("email", "==", searchTerm.toLowerCase()),
    limit(1) // Expecting at most 1 user for an exact email match
  );
  
  const querySnapshot = await getDocs(q);
  const users: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    if (doc.id !== currentUserId) { 
      users.push({ uid: doc.id, ...doc.data() } as UserProfile);
    }
  });
  return users;
}


// Chats Collection
export async function createChat(currentUserId: string, otherUserId: string): Promise<string> {
  const chatsRef = collection(db, "chats");
  // Query for existing chat between these two users
  // This might need an index on 'participants' array for both users
  const q = query(chatsRef, 
    where("participants", "array-contains", currentUserId)
  );
  
  const querySnapshot = await getDocs(q);
  for (const docSnap of querySnapshot.docs) {
    const chat = docSnap.data() as Chat;
    if (chat.participants.includes(otherUserId) && chat.participants.length === 2) {
      return docSnap.id; // Existing chat found
    }
  }

  // Create new chat
  const newChatRef = doc(collection(db, "chats"));
  const newChat: Chat = {
    id: newChatRef.id,
    participants: [currentUserId, otherUserId].sort(), // Sort for consistent querying
    createdAt: Date.now(),
    updatedAt: Date.now(),
    participantProfiles: {}, // Initialize empty
  };
  await setDoc(newChatRef, newChat);
  return newChatRef.id;
}

export async function getChats(userId: string, callback: (chats: Chat[]) => void): Promise<() => void> {
  const chatsRef = collection(db, "chats");
  // **IMPORTANT FIREBASE INDEX REQUIRED**
  // This query requires a composite index in Firestore.
  // If you see a "FAILED_PRECONDITION: The query requires an index" error,
  // please create the index in your Firebase console.
  // The error message usually provides a direct link to create it.
  // The index should be on the 'chats' collection, for:
  // 1. `participants` (Array Contains)
  // 2. `updatedAt` (Descending)
  // Example link from error: https://console.firebase.google.com/v1/r/project/{YOUR_PROJECT_ID}/firestore/indexes?create_composite=...
  const q = query(chatsRef, where("participants", "array-contains", userId), orderBy("updatedAt", "desc"));
  
  const unsubscribe = onSnapshot(q, async (querySnapshot) => {
    const chats: Chat[] = [];
    for (const docSnap of querySnapshot.docs) {
      const chatData = docSnap.data() as Chat;
      const participantProfiles: Chat['participantProfiles'] = {};
      if (chatData.participants) {
        for (const pId of chatData.participants) {
          if (pId !== userId) { 
             const profile = await getUserProfile(pId);
             if (profile) {
                // Only store necessary, non-sensitive info for quick display
                participantProfiles[pId] = { displayName: profile.displayName, photoURL: profile.photoURL };
             }
          }
        }
      }
      // Simplified last message preview logic
      let lastDecryptedMessagePreview = "[Encrypted Message]";
      if (chatData.lastMessage) {
        if (chatData.lastMessage.senderId === userId) {
          lastDecryptedMessagePreview = "You: [Encrypted]";
        } else {
          lastDecryptedMessagePreview = "[Encrypted]";
        }
      }


      chats.push({ 
        ...chatData, 
        id: docSnap.id, 
        participantProfiles,
        lastDecryptedMessagePreview 
      });
    }
    callback(chats);
  });
  return unsubscribe;
}


// Messages Subcollection
export async function sendMessage(
  chatId: string,
  senderId: string,
  messageContent: string
): Promise<void> {
  const chatDocRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatDocRef);
  if (!chatSnap.exists()) {
    throw new Error(`Chat with ID ${chatId} not found.`);
  }
  const chatData = chatSnap.data() as Chat;
  const participants = chatData.participants;

  if (!participants || participants.length === 0) {
    throw new Error(`Chat ${chatId} has no participants.`);
  }

  const publicKeysMap: { [userId: string]: JsonWebKey } = {};
  for (const userId of participants) {
    const userProfile = await getUserProfile(userId);
    if (userProfile?.publicKey) {
      publicKeysMap[userId] = userProfile.publicKey;
    } else {
      console.error(`User ${userId} in chat ${chatId} does not have a public key. Cannot send message securely to all participants.`);
      throw new Error(`Cannot encrypt message for user ${userId}: public key missing. Please ensure all participants have generated keys.`);
    }
  }

  const { encryptedContent, encryptedSessionKeys } = await encryptMessage(messageContent, publicKeysMap);

  const messagesRef = collection(db, "chats", chatId, "messages");
  const newMessageDocData: Omit<ChatMessage, 'id' | 'senderDisplayName'> = {
    chatId,
    senderId,
    encryptedContent,
    encryptedSessionKeys,
    timestamp: Date.now(),
  };
  await addDoc(messagesRef, newMessageDocData);

  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
    lastMessage: {
      encryptedContent: encryptedContent.substring(0, 50) + "...", 
      timestamp: newMessageDocData.timestamp,
      senderId: senderId,
    },
    updatedAt: newMessageDocData.timestamp,
  });
}

export async function getMessages(
  chatId: string, 
  currentUserPrivateKey: CryptoKey | null, 
  callback: (messages: DecryptedChatMessage[]) => void
): Promise<() => void> {
  
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"), limit(100));
  
  const unsubscribe = onSnapshot(q, async (querySnapshot) => {
    const messages: DecryptedChatMessage[] = [];
    const participantProfilesCache: Record<string, UserProfile | null> = {};
    const currentAuthUser = auth.currentUser;

    for (const docSnap of querySnapshot.docs) {
      const msgData = docSnap.data() as ChatMessage;
      msgData.id = docSnap.id;

      let decryptedContent = "";
      let senderDisplayName = "Unknown User";
      
      if (!participantProfilesCache[msgData.senderId]) {
        participantProfilesCache[msgData.senderId] = await getUserProfile(msgData.senderId);
      }
      const senderProfile = participantProfilesCache[msgData.senderId];
      senderDisplayName = senderProfile?.displayName || "User";

      if (!currentAuthUser?.uid) {
        decryptedContent = "[Not authenticated]";
      } else if (!currentUserPrivateKey) {
        decryptedContent = "[Your private key missing]";
      } else if (!msgData.encryptedSessionKeys || Object.keys(msgData.encryptedSessionKeys).length === 0 || !msgData.encryptedContent) {
        decryptedContent = "[Encrypted data missing on message]";
      } else {
        const encryptedSessionKeyForCurrentUser = msgData.encryptedSessionKeys[currentAuthUser.uid];
        
        if (!encryptedSessionKeyForCurrentUser) {
          decryptedContent = "[Not encrypted for you]";
           if (msgData.senderId === currentAuthUser.uid) {
            decryptedContent = "[Error: Sent message key missing for self. This message may be from before a key change or if self-encryption failed.]";
          }
          console.warn(`Message ${msgData.id}: Not encrypted for current user ${currentAuthUser.uid}. Sender: ${msgData.senderId}`);
        } else {
          try {
            decryptedContent = await decryptMessage(
              msgData.encryptedContent,
              encryptedSessionKeyForCurrentUser,
              currentUserPrivateKey,
              senderProfile?.publicKey 
            );
          } catch (e: any) {
            console.error(`Failed to decrypt message (ID: ${msgData.id}, User: ${currentAuthUser.uid}, Sender: ${msgData.senderId}):`, e.message, e.name);
            if (msgData.senderId === currentAuthUser.uid) {
              decryptedContent = "[Decryption failed - Your key issue?]";
            } else {
              decryptedContent = "[Decryption Failed]";
            }
            if (e.name === 'OperationError') {
                console.error("Decryption OperationError Details: This often means a key mismatch or corrupted data.");
            }
          }
        }
      }
      
      messages.push({
        ...msgData,
        content: decryptedContent,
        senderDisplayName: senderDisplayName,
      });
    }
    callback(messages);
  });
  return unsubscribe;
}

export async function deleteMessage(chatId: string, messageId: string, currentUserId: string): Promise<void> {
  const messageRef = doc(db, "chats", chatId, "messages", messageId);
  const messageSnap = await getDoc(messageRef);

  if (!messageSnap.exists()) {
    throw new Error("Message not found.");
  }

  const messageData = messageSnap.data() as ChatMessage;

  if (messageData.senderId !== currentUserId) {
    throw new Error("You can only delete your own messages.");
  }

  await deleteDoc(messageRef);

  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (chatSnap.exists() && chatSnap.data()?.lastMessage?.encryptedContent === messageData.encryptedContent.substring(0, 50) + "..." && chatSnap.data()?.lastMessage?.timestamp === messageData.timestamp) {
      const messagesCollectionRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesCollectionRef, orderBy("timestamp", "desc"), limit(1));
      const prevMessagesSnap = await getDocs(q);
      
      if (!prevMessagesSnap.empty) {
          const newLastMessage = prevMessagesSnap.docs[0].data() as ChatMessage;
          await updateDoc(chatRef, {
              lastMessage: {
                  encryptedContent: newLastMessage.encryptedContent.substring(0, 50) + "...",
                  timestamp: newLastMessage.timestamp,
                  senderId: newLastMessage.senderId,
              },
              updatedAt: newLastMessage.timestamp,
          });
      } else {
          await updateDoc(chatRef, {
              lastMessage: null,
              updatedAt: Date.now(),
          });
      }
  }
}
