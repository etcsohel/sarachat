
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import ChatList from "@/components/chat/ChatList";
import ChatWindow from "@/components/chat/ChatWindow";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react"; // Changed from Search
import UserSearchDialog from "@/components/chat/UserSearchDialog";
import { useIsMobile } from "@/hooks/use-mobile";


export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [activeMobileChatIdForAnimation, setActiveMobileChatIdForAnimation] = useState<string | null>(null);
  const [isMobileOverlayMounted, setIsMobileOverlayMounted] = useState<boolean>(false);
  const [mobileOverlayAnimationClasses, setMobileOverlayAnimationClasses] = useState<string>("");

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl) {
      setSelectedChatId(chatIdFromUrl);
    } else {
      setSelectedChatId(null); 
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedChatId) {
      setActiveMobileChatIdForAnimation(selectedChatId);
      setMobileOverlayAnimationClasses("animate-in slide-in-from-right fade-in duration-100 ease-out");
      setIsMobileOverlayMounted(true);
    } else {
      if (isMobileOverlayMounted) { 
        setMobileOverlayAnimationClasses("animate-out slide-out-to-right fade-out duration-100 ease-in");
        const timer = setTimeout(() => {
          setIsMobileOverlayMounted(false);
          setActiveMobileChatIdForAnimation(null); 
        }, 100); 
        return () => clearTimeout(timer);
      }
    }
  }, [selectedChatId, isMobileOverlayMounted]); 

  const handleSelectChat = (chatId: string) => {
    router.push(`/dashboard?chatId=${chatId}`, { scroll: false });
  };

  const handleCloseMobileChat = () => {
    router.push('/dashboard', { scroll: false });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden"> 
      <div className="w-full md:w-[300px] lg:w-[340px] flex-shrink-0 h-full overflow-hidden border-r border-border"> 
        <ChatList selectedChatId={selectedChatId} onSelectChat={handleSelectChat} />
      </div>
      <div className="flex-1 h-full hidden md:flex overflow-hidden"> 
        <ChatWindow chatId={selectedChatId} />
      </div>

      {isMobileOverlayMounted && activeMobileChatIdForAnimation && (
        <div 
          className={`md:hidden fixed inset-x-0 top-16 bottom-0 bg-background z-50 flex flex-col overflow-hidden ${mobileOverlayAnimationClasses}`}
        >
           <ChatWindow chatId={activeMobileChatIdForAnimation} onCloseChat={handleCloseMobileChat} />
        </div>
      )}

      {/* Mobile Search FAB */}
      {isMobile && !selectedChatId && (
        <>
          <Button
            variant="default"
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-30 md:hidden flex items-center justify-center"
            onClick={() => setIsMobileSearchOpen(true)}
            aria-label="Start new chat"
          >
            <UserPlus className="h-6 w-6" />
          </Button>
          <UserSearchDialog isOpen={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen} />
        </>
      )}
    </div>
  );
}
