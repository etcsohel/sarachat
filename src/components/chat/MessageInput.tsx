
"use client";

import { useState, type FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessageInputProps {
  chatId: string;
  onSendMessage: (chatId: string, content: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ chatId, onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(chatId, message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; 
        textareaRef.current.focus();
      }
    } catch (error: any) {
      toast({
        title: "Error Sending Message",
        description: error.message || "Could not send your message.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${event.target.scrollHeight}px`;
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center p-3 border-t bg-card space-x-2" // Changed items-end to items-center
    >
      <Textarea
        ref={textareaRef}
        placeholder={disabled ? "Cannot send messages to this user" : "Type your message here..."}
        value={message}
        onChange={handleTextareaInput}
        onKeyDown={handleKeyDown}
        rows={1}
        className="flex-1 resize-none max-h-32 text-sm py-2.5 px-3.5 rounded-2xl border-input focus-visible:ring-primary focus-visible:ring-offset-0"
        disabled={isSending || disabled}
        aria-label="Message input"
      />
      <Button type="submit" size="icon" disabled={!message.trim() || isSending || disabled} className="rounded-2xl h-10 w-10 shrink-0 bg-primary hover:bg-primary/90">
        <Send className="h-5 w-5" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
