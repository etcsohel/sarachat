
"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";

// Define GoogleIcon as an inline SVG component
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 381.7 512 244 512 110.3 512 0 401.7 0 265.4S110.3 18.8 244 18.8c71.2 0 126.9 27.7 170.7 67.8l-63.6 62.3C314.6 119.9 282.8 102 244 102c-74.3 0-134.3 60-134.3 134.3s60 134.3 134.3 134.3c87.6 0 111.1-67.2 114.4-97.8H244v-77h243.2c1.6 10.4 3.2 21.2 3.2 32.4z"></path>
  </svg>
);


interface OAuthButtonsProps {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export default function OAuthButtons({ setIsLoading }: OAuthButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { useAuthContext } = require('@/hooks/useAuthContext'); // Local require for ensureKeys
  const { ensureKeys } = useAuthContext();


  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // ensureKeys will be called by AuthContext
      toast({ title: "Google Sign-In Successful", description: "Welcome to SaraChat!" });
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} >
        <GoogleIcon />
        Google
      </Button>
    </>
  );
}
