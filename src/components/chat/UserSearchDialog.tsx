
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import type { UserProfile } from "@/types";
import { searchUsers, createChat } from "@/lib/firebase/firestore"; // Assuming these functions exist
import { useAuthContext } from "@/hooks/useAuthContext";
import UserAvatar from "@/components/common/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";


interface UserSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function UserSearchDialog({ isOpen, onOpenChange }: UserSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const { user: currentUser } = useAuthContext();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setSearchResults([]);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchTerm.trim() || !currentUser) return;
    setIsLoading(true);
    try {
      const users = await searchUsers(searchTerm, currentUser.uid);
      setSearchResults(users);
    } catch (error) {
      console.error("Error searching users:", error);
      toast({ title: "Search Failed", description: "Could not perform user search.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Auto-search logic removed. Search is now triggered by button click or Enter key.
    if (e.target.value.trim() === "") {
      setSearchResults([]); // Clear results if input is empty
    }
  };
  
  const handleCreateChat = async (otherUser: UserProfile) => {
    if (!currentUser) return;
    setIsCreatingChat(true);
    try {
      const chatId = await createChat(currentUser.uid, otherUser.uid);
      toast({ title: "Chat Started", description: `You can now chat with ${otherUser.displayName || otherUser.email}.` });
      onOpenChange(false); // Close dialog
      router.push(`/dashboard?chatId=${chatId}`); // Navigate to the chat or update state
    } catch (error) {
      console.error("Error starting chat:", error);
      toast({ title: "Failed to Start Chat", description: "Could not initiate the conversation.", variant: "destructive" });
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center text-xl">
            <Users className="mr-2 h-6 w-6 text-primary" /> Start a New Chat
          </DialogTitle>
          <DialogDescription>
            Search for users by their email to begin a secure conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-4">
          <div className="relative flex items-center">
            <Input
              id="user-search"
              placeholder="Enter user's email..."
              value={searchTerm}
              onChange={handleInputChange}
              className="pr-10"
              disabled={isLoading}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
              onClick={handleSearch}
              disabled={isLoading || !searchTerm.trim()}
              aria-label="Search"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/50">
              {searchResults.map((user) => (
                <div key={user.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <UserAvatar user={user} size={8} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.displayName || "Unknown User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleCreateChat(user)} 
                    disabled={isCreatingChat}
                    variant="outline"
                  >
                    {isCreatingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
                    Chat
                  </Button>
                </div>
              ))}
            </div>
          )}
          {/* Show this message only if a search has been attempted (isLoading is false and searchTerm has been entered) and no results found */}
          {searchTerm.trim() && !isLoading && searchResults.length === 0 && (
             <p className="text-sm text-center text-muted-foreground py-4">User does not exist on SaraChat.</p>
          )}
        </div>
        <DialogFooter className="p-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
