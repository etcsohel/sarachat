
"use client";

import type { DecryptedChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import UserAvatar from "@/components/common/UserAvatar";
import { ShieldCheck, Trash2 } from "lucide-react";

interface MessageBubbleProps {
  message: DecryptedChatMessage;
  isSender: boolean;
  onDeleteMessage?: (messageId: string) => void;
}

export default function MessageBubble({ message, isSender, onDeleteMessage }: MessageBubbleProps) {
  const time = format(new Date(message.timestamp), "p"); // e.g., 2:30 PM

  const handleDelete = () => {
    if (onDeleteMessage) {
      onDeleteMessage(message.id);
    }
  };

  return (
    <div className={cn("flex mb-3 group/message-bubble", isSender ? "justify-end" : "justify-start")}>
      <div className={cn("flex items-end max-w-[75%] md:max-w-[60%]", isSender ? "flex-row-reverse" : "flex-row")}>
        {!isSender && (
          <UserAvatar user={{displayName: message.senderDisplayName, photoURL: null /* Fetch if needed */}} size={6} className="mr-2 self-end mb-1" />
        )}
        {isSender && onDeleteMessage && (
          <button
            onClick={handleDelete}
            className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover/message-bubble:opacity-100 transition-opacity mx-1 self-center"
            title="Delete message"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete message</span>
          </button>
        )}
        <div
          className={cn(
            "py-2 px-3 rounded-xl shadow-md relative", // Removed group from here
            isSender
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-card text-card-foreground rounded-bl-none border"
          )}
        >
          {!isSender && message.senderDisplayName && (
             <p className="text-xs font-semibold mb-0.5 text-accent">{message.senderDisplayName}</p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          <div className="flex items-center mt-1 text-xs opacity-70 group-hover:opacity-100 transition-opacity">
            <span>{time}</span>
            <ShieldCheck className="ml-1.5 h-3 w-3 text-green-400" title="End-to-end encrypted" />
          </div>
        </div>
      </div>
    </div>
  );
}
