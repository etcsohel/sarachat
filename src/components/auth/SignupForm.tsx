
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signUpWithEmail } from "@/lib/firebase/auth";
import Link from "next/link";
import { Mail, Lock, User, UserPlus } from "lucide-react";
import OAuthButtons from "./OAuthButtons";

const signupSchema = z.object({
  displayName: z.string().min(3, { message: "Display name must be at least 3 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormInputs = z.infer<typeof signupSchema>;

export default function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { useAuthContext } = require('@/hooks/useAuthContext'); // Local require for ensureKeys
  const { ensureKeys } = useAuthContext();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit: SubmitHandler<SignupFormInputs> = async (data) => {
    setIsLoading(true);
    try {
      await signUpWithEmail(data.email, data.password, data.displayName);
      // ensureKeys will be called by AuthContext after auth state change
      toast({ title: "Signup Successful", description: "Welcome to SaraChat! Your secure keys have been generated." });
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card shadow-xl rounded-lg">
        <div className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-3xl font-bold text-foreground mt-2">Create Account</h1>
          <p className="text-muted-foreground">Join SaraChat for secure messaging</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
             <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your Name"
                  {...register("displayName")}
                  className="pl-10"
                  aria-invalid={errors.displayName ? "true" : "false"}
                />
            </div>
            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  className="pl-10"
                  aria-invalid={errors.email ? "true" : "false"}
                />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                  className="pl-10"
                  aria-invalid={errors.password ? "true" : "false"}
                />
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
             <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                  className="pl-10"
                  aria-invalid={errors.confirmPassword ? "true" : "false"}
                />
            </div>
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Sign Up"}
          </Button>
        </form>
        
        <OAuthButtons setIsLoading={setIsLoading} />
        
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
