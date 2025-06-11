
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/hooks/useAuthContext";
import { signOutUser } from "@/lib/firebase/auth";
import { siteConfig } from "@/config/site";
import UserAvatar from "@/components/common/UserAvatar";
import { LogOut, MessageSquarePlus, UserPlus, Settings, ShieldCheck, UserCircle } from "lucide-react";
import UserSearchDialog from "@/components/chat/UserSearchDialog";
import { useState } from "react";

export default function AppHeader() {
  const { user, userKeys, ensureKeys } = useAuthContext();
  const router = useRouter();
  const { toast } = useToast();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Logout Failed",
        description: error.message || "An error occurred during logout.",
        variant: "destructive",
      });
    }
  };

  const handleManageKeys = async () => {
    if (!user) return;
    try {
      await ensureKeys(); // This will attempt to generate/verify keys
      if (userKeys?.publicKey && userKeys?.privateKey) {
        toast({ title: "Keys Verified", description: "Your cryptographic keys are in place." });
      } else {
         toast({ title: "Key Generation", description: "New cryptographic keys have been generated and stored locally." });
      }
    } catch (error) {
       toast({ title: "Key Management Error", description: "Could not manage cryptographic keys.", variant: "destructive" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container flex h-16 items-center justify-between p-4 mx-auto max-w-7xl">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <MessageSquarePlus className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">{siteConfig.name}</span>
        </Link>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Search button hidden on mobile, visible on md+ */}
          <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} aria-label="Start new chat" className="hidden md:inline-flex">
            <UserPlus className="h-5 w-5" />
          </Button>
          <UserSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <UserAvatar user={user.profile} size={8} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.profile?.displayName || user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}> {/* Placeholder for profile page */}
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManageKeys}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  <span>Manage Keys</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled> {/* Placeholder for settings */}
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
