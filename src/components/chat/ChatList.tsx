
"use client";

import { useEffect, useState } from "react";
import type { Chat } from "@/types"; // Removed DecryptedChatMessage as it's not directly used for preview
import ChatItem from "./ChatItem";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getChats } from "@/lib/firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
// Decryption for preview is complex and removed for simplification: import { decryptMessage } from "@/lib/crypto";

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

export default function ChatList({ selectedChatId, onSelectChat }: ChatListProps) {
  const { user, userKeys } = useAuthContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    setIsLoading(true);
    const unsubscribePromise = getChats(user.uid, async (fetchedChats) => {
      // Simplified last message preview logic
      const chatsWithPreviews = fetchedChats.map(chat => {
        let preview = "[Encrypted Message]";
        if (chat.lastMessage && chat.lastMessage.encryptedContent) {
            // The preview stored in chat.lastMessage.encryptedContent is just a snippet of the AES encrypted text.
            // We cannot decrypt it here without the AES key, which is per-message and itself encrypted.
            // So, we just indicate its state.
            preview = chat.lastMessage.senderId === user.uid ? "You: [Encrypted]" : "[Encrypted]";
        }
        return { ...chat, lastDecryptedMessagePreview: preview };
      });
      
      setChats(chatsWithPreviews);
      setIsLoading(false);
    });

    return () => {
      unsubscribePromise.then(fn => fn()).catch(e => console.error("Error unsubscribing from chats:", e));
      setIsLoading(false); // Ensure loading is false on cleanup
    }
  }, [user?.uid]); // Removed userKeys and user.profile.publicKey as direct decryption isn't done here anymore

  const filteredChats = chats.filter(chat => {
    const otherParticipantId = chat.participants.find(pId => pId !== user?.uid);
    const otherParticipantProfile = otherParticipantId ? chat.participantProfiles?.[otherParticipantId] : null;
    const name = otherParticipantProfile?.displayName || "Unknown User";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r bg-card">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search chats..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {filteredChats.length > 0 ? (
          <div className="p-2 space-y-1">
            {filteredChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                currentUserId={user!.uid}
                isSelected={selectedChatId === chat.id}
                onSelectChat={onSelectChat}
              />
            ))}
          </div>
        ) : (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {searchTerm ? "No chats match your search." : "No active chats. Start a new conversation!"}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
