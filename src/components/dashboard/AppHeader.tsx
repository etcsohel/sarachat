
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
import { LogOut, UserPlus, Settings, ShieldCheck, UserCircle } from "lucide-react";
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
      await ensureKeys(true); // Pass true for manual trigger if needed, or adjust ensureKeys
      // After ensureKeys, userKeys state in context will be updated. Check it directly.
      const updatedUserKeys = userKeys; // Re-access from context after ensureKeys awaited

      if (updatedUserKeys?.publicKey && updatedUserKeys?.privateKey) {
        toast({ title: "Keys Verified", description: "Your cryptographic keys are active on this device." });
      } else if (updatedUserKeys?.publicKey && !updatedUserKeys?.privateKey) {
         toast({ 
            title: "Private Key Missing", 
            description: "Your public key is recognized, but the private key for this device is not found. You may not be able to decrypt old messages or send new ones from this device.", 
            variant: "default", // Use 'default' or 'destructive' based on severity preference
            duration: 9000 
        });
      } else { // This case implies ensureKeys decided to generate new keys or failed to load any.
         toast({ title: "Key Status", description: "Cryptographic keys checked. If new, they are now stored locally." });
      }
    } catch (error: any) {
       toast({ title: "Key Management Error", description: error.message || "Could not manage cryptographic keys.", variant: "destructive" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container flex h-16 items-center justify-between p-4 mx-auto max-w-7xl">
        <Link href="/dashboard" className="flex items-center space-x-2">
          {/* Replace with your custom icon. Make sure to place 'custom-app-icon.svg' (or your chosen name) in the 'public' folder */}
          <img src="https://blogger.googleusercontent.com/img/a/AVvXsEgb7AYsicehogwx8QdCkgtht4fqdYOt995kXBS_0SImxjcdv18O-L7jDrSRsbrwxONks-PvK2QFnHDfRfwwpRXL_IqRr_DhRMEbsTMn5uhgeu2uI1ySlJ2LA4_0mUuM6uPdFcG1TxMsaAzt2YzhwADRTYGwuem6sxEECwoa9-jAYtSw48QQ8ZTvQyGd-bo" alt={siteConfig.name + " logo"} className="h-7 w-7" />
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
                <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManageKeys}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  <span>Manage Keys</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled> 
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
