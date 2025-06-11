"use client";

import type { Chat, UserProfile } from "@/types";
import UserAvatar from "@/components/common/UserAvatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from 'date-fns';
import { ShieldCheck } from "lucide-react"; // For E2EE indicator

interface ChatItemProps {
  chat: Chat;
  currentUserId: string;
  isSelected: boolean;
  onSelectChat: (chatId: string) => void;
}

export default function ChatItem({ chat, currentUserId, isSelected, onSelectChat }: ChatItemProps) {
  const otherParticipantId = chat.participants.find(pId => pId !== currentUserId);
  const otherParticipantProfile = otherParticipantId ? chat.participantProfiles?.[otherParticipantId] : null;

  const displayName = otherParticipantProfile?.displayName || "Unknown User";
  // Use a placeholder if photoURL is missing for the other participant
  const displayableProfile: Partial<UserProfile> = {
    displayName: displayName,
    photoURL: otherParticipantProfile?.photoURL,
  };

  // Last message preview decryption logic would be complex here.
  // For simplicity, we might show "[Encrypted Message]" or a timestamp.
  // The prompt asks for last message previews. This means client-side decryption for preview.
  // This component will just show placeholder for now.
  let lastMessagePreview = chat.lastDecryptedMessagePreview || "[Encrypted Message]";
  if (chat.lastMessage?.senderId === currentUserId) {
    lastMessagePreview = "You: " + lastMessagePreview;
  }
  
  const lastMessageTimestamp = chat.lastMessage?.timestamp 
    ? formatDistanceToNowStrict(new Date(chat.lastMessage.timestamp), { addSuffix: true })
    : "";

  return (
    <button
      onClick={() => onSelectChat(chat.id)}
      className={cn(
        "flex items-center w-full p-3 space-x-3 rounded-lg transition-colors hover:bg-accent/80",
        isSelected ? "bg-primary/10 text-primary-foreground" : "bg-card hover:bg-muted/50"
      )}
      aria-current={isSelected ? "page" : undefined}
    >
      <UserAvatar user={displayableProfile as UserProfile} size={10} />
      <div className="flex-1 min-w-0 text-left">
        <div className="flex justify-between items-center">
          <h3 className={cn("text-sm font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>{displayName}</h3>
          {lastMessageTimestamp && <span className={cn("text-xs", isSelected ? "text-primary/80" : "text-muted-foreground")}>{lastMessageTimestamp}</span>}
        </div>
        <p className={cn("text-xs truncate", isSelected ? "text-primary/90" : "text-muted-foreground")}>
          {lastMessagePreview}
        </p>
      </div>
      <ShieldCheck className={cn("h-4 w-4 shrink-0", isSelected ? "text-accent" : "text-green-500")} title="End-to-end encrypted" />
    </button>
  );
}
