
"use client";

import { useEffect, useState, useRef } from "react";
import type { DecryptedChatMessage, UserProfile } from "@/types";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getMessages, sendMessage, getUserProfile, deleteMessage as deleteMessageFromDb } from "@/lib/firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, MessagesSquare, ShieldAlert, ArrowLeft, Trash2, ShieldCheck } from "lucide-react"; // Added ShieldCheck
import UserAvatar from "@/components/common/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatWindowProps {
  chatId: string | null;
  onCloseChat?: () => void; // Optional callback for closing the chat (e.g., on mobile)
}

export default function ChatWindow({ chatId, onCloseChat }: ChatWindowProps) {
  const { user, userKeys } = useAuthContext();
  const [messages, setMessages] = useState<DecryptedChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [otherParticipant, setOtherParticipant] = useState<UserProfile | null>(null);
  const [chatData, setChatData] = useState<any>(null); // To store chat document data
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !user?.uid || !userKeys?.privateKey) {
      setMessages([]);
      setOtherParticipant(null);
      setChatData(null);
      return;
    }

    setIsLoadingMessages(true);
    
    const fetchChatDetails = async () => {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db: firestoreDb } = await import("@/lib/firebase/firebase"); 
      const chatDocRef = doc(firestoreDb, "chats", chatId);
      const chatSnap = await getDoc(chatDocRef);

      if (chatSnap.exists()) {
        const fetchedChatData = chatSnap.data();
        setChatData(fetchedChatData); 
        const otherUserId = fetchedChatData.participants.find((pId: string) => pId !== user.uid);
        if (otherUserId) {
          const profile = await getUserProfile(otherUserId);
          setOtherParticipant(profile);
        } else {
          setOtherParticipant(null); 
        }
      } else {
        setOtherParticipant(null);
        setChatData(null);
      }
    };
    fetchChatDetails();

    const unsubscribePromise = getMessages(chatId, userKeys.privateKey, (fetchedMessages) => {
      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    });

    return () => {
      unsubscribePromise.then(fn => fn()).catch(e => console.error("Error unsubscribing from messages:", e));
    };
  }, [chatId, user?.uid, userKeys?.privateKey]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if(scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (currentChatId: string, content: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User not authenticated for sending message.", variant: "destructive"});
      throw new Error("User not authenticated for sending message.");
    }
    try {
        await sendMessage(currentChatId, user.uid, content);
    } catch (error: any) {
        toast({ title: "Message Not Sent", description: error.message || "Could not send the message.", variant: "destructive"});
    }
  };

  const promptDeleteMessage = (messageId: string) => {
    setMessageToDeleteId(messageId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!chatId || !messageToDeleteId || !user?.uid) {
      toast({ title: "Error", description: "Cannot delete message. Context missing.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      setMessageToDeleteId(null);
      return;
    }

    try {
      await deleteMessageFromDb(chatId, messageToDeleteId, user.uid);
      toast({ title: "Message Deleted", description: "The message has been removed." });
      // Messages state will update via onSnapshot listener
    } catch (error: any) {
      console.error("Failed to delete message on client:", error);
      if (error.message && (error.message.toLowerCase().includes("permission") || error.message.toLowerCase().includes("permissions") || (error.name === "FirebaseError" && error.code === "permission-denied"))) {
          toast({ 
            title: "Deletion Failed: Permissions", 
            description: "You may not have permission to delete this message. Please check your Firestore security rules.", 
            variant: "destructive",
            duration: 9000 
          });
      } else {
          toast({ title: "Error Deleting Message", description: error.message || "Could not delete the message.", variant: "destructive" });
      }
    } finally {
      setIsDeleteDialogOpen(false);
      setMessageToDeleteId(null);
    }
  };


  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-muted/30 p-8 text-center">
        <MessagesSquare className="h-20 w-20 text-muted-foreground mb-6" />
        <h2 className="text-xl font-semibold text-foreground">Select a chat to start messaging</h2>
        <p className="text-muted-foreground">Your conversations are end-to-end encrypted.</p>
      </div>
    );
  }

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading messages...</p>
      </div>
    );
  }
  
  if (!userKeys?.privateKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-destructive/10 p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive-foreground">Cannot Decrypt Messages</h2>
        <p className="text-destructive-foreground/80">Your private key is not available. Please ensure your keys are set up correctly.</p>
        <p className="text-xs text-destructive-foreground/60 mt-2">Try managing keys from your profile menu.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="p-3 border-b bg-card flex items-center space-x-2 shadow-sm">
        {onCloseChat && (
          <Button variant="ghost" size="icon" onClick={onCloseChat} className="mr-1 md:hidden">
            <ArrowLeft className="h-5 w-5 text-foreground" />
            <span className="sr-only">Back to chats</span>
          </Button>
        )}
        {otherParticipant && (
          <>
            <UserAvatar user={otherParticipant} size={8} />
            <div>
                <h2 className="text-md font-semibold text-foreground">{otherParticipant.displayName || "Chat"}</h2>
            </div>
          </>
        )}
         {!otherParticipant && chatId && ( 
            <div>
                 <h2 className="text-md font-semibold text-foreground">Chat</h2>
            </div>
         )}
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {chatId && (
          <div className="text-center text-xs text-muted-foreground mb-4 p-2 bg-muted/50 rounded-md sticky top-0 z-10">
            <ShieldCheck className="inline-block h-3 w-3 mr-1 text-green-500" />
            This chat is End-to-End Encrypted.
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isSender={msg.senderId === user?.uid}
            onDeleteMessage={msg.senderId === user?.uid ? promptDeleteMessage : undefined}
          />
        ))}
        {messages.length === 0 && !isLoadingMessages && (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Be the first to say something!</p>
        )}
      </ScrollArea>
      <MessageInput 
        chatId={chatId} 
        onSendMessage={handleSendMessage} 
        disabled={!otherParticipant?.publicKey} 
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMessageToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMessage} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
