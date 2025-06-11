"use client";

import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";
import type { UserProfile } from "@/types";

interface UserAvatarProps {
  user?: UserProfile | null;
  className?: string;
  size?: number; // Simple size prop for consistency
}

export default function UserAvatar({ user, className, size = 10 }: UserAvatarProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    const names = name.split(" ");
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const avatarSizeClass = `h-${size} w-${size}`;
  const fallbackIconSizeClass = `h-${Math.floor(size*0.6)} w-${Math.floor(size*0.6)}`;


  return (
    <Avatar className={cn(avatarSizeClass, className)}>
      {user?.photoURL ? (
        <AvatarImage src={user.photoURL} alt={user.displayName || "User Avatar"} />
      ) : user?.displayName ? (
         <AvatarImage src={`https://placehold.co/40x40.png?text=${getInitials(user.displayName)}`} alt={user.displayName || "User Avatar"} data-ai-hint="profile avatar" />
      ) : (
        <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="profile avatar" />
      )}
      <AvatarFallback className={cn(avatarSizeClass)}>
        {user?.displayName ? (
          getInitials(user.displayName)
        ) : (
          <UserIcon className={cn(fallbackIconSizeClass, "text-muted-foreground")} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

// Helper to apply dynamic Tailwind classes
// This is a common pattern, but for simple H/W, direct style or specific classes are fine.
// For this example, I'll use a simpler approach if cn doesn't directly support dynamic class names like h-${size}.
// The above usage with string template for size is fine for Shadcn Avatar's className prop.
import { cn } from "@/lib/utils";
