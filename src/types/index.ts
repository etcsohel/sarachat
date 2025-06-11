
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  publicKey?: JsonWebKey; // Stored in Firestore
  createdAt: number;
}

// This will be the user object available in AuthContext
export interface AuthUser extends FirebaseUser {
  profile?: UserProfile; // Additional profile data
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  encryptedContent: string; // Message content encrypted with AES-GCM (IV prepended)
  encryptedSessionKeys: { [participantId: string]: string }; // AES session key, RSA-encrypted for each participant
  timestamp: number;
  senderDisplayName?: string; // Optional: denormalized for display
}

export interface DecryptedChatMessage extends Omit<ChatMessage, 'encryptedContent' | 'encryptedSessionKeys'> {
  content: string; // Decrypted message content
}

export interface Chat {
  id: string;
  participants: string[]; // Array of user UIDs
  participantProfiles?: Record<string, Pick<UserProfile, 'displayName' | 'photoURL'>>; // For quick display
  lastMessage?: Pick<ChatMessage, 'encryptedContent' | 'timestamp' | 'senderId'>; // Encrypted preview
  lastDecryptedMessagePreview?: string; // For UI display
  createdAt: number;
  updatedAt: number;
}
