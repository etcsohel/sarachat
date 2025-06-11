
"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { UserCircle, Mail, Save, Loader2, Link as LinkIcon, LockKeyhole, Lock, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase/firebase";
import { updateProfile as updateFirebaseProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { updateUserProfile } from "@/lib/firebase/firestore";
import UserAvatar from "@/components/common/UserAvatar";
import { Separator } from "@/components/ui/separator";

const profileEditSchema = z.object({
  displayName: z.string().min(3, { message: "Display name must be at least 3 characters." }).max(50, { message: "Display name must be 50 characters or less." }),
  photoURL: z.string().url({ message: "Please enter a valid URL for the avatar." }).or(z.literal('')).optional(),
});

type ProfileEditFormInputs = z.infer<typeof profileEditSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match.",
  path: ["confirmNewPassword"],
});

type ChangePasswordFormInputs = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { user, ensureKeys, loading: authLoading } = useAuthContext();
  const { toast } = useToast();
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfileForm,
    formState: { errors: profileErrors, isDirty: isProfileDirty },
    watch: watchProfile
  } = useForm<ProfileEditFormInputs>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      displayName: "",
      photoURL: "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPasswordChange,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormInputs>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: ""
    }
  });

  const currentPhotoURL = watchProfile("photoURL");

  useEffect(() => {
    if (user?.profile) {
      resetProfileForm({
        displayName: user.profile.displayName || "",
        photoURL: user.profile.photoURL || "",
      });
    }
  }, [user, resetProfileForm]);

  const onProfileSubmit: SubmitHandler<ProfileEditFormInputs> = async (data) => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (!isProfileDirty) {
      toast({ title: "No Changes", description: "You haven't made any changes to save."});
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const newDisplayName = data.displayName;
      const newPhotoURL = data.photoURL || null;

      const authUpdates: { displayName?: string; photoURL?: string | null } = {};
      const firestoreUpdates: { displayName?: string; photoURL?: string | null } = {};
      let changesMade = false;

      if (newDisplayName !== (user.profile?.displayName || "")) {
        authUpdates.displayName = newDisplayName;
        firestoreUpdates.displayName = newDisplayName;
        changesMade = true;
      }

      if (newPhotoURL !== (user.profile?.photoURL || null)) {
        authUpdates.photoURL = newPhotoURL;
        firestoreUpdates.photoURL = newPhotoURL;
        changesMade = true;
      }

      if (changesMade) {
        await updateFirebaseProfile(auth.currentUser, authUpdates);
        await updateUserProfile(user.uid, firestoreUpdates);
        await ensureKeys(); 
        toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      } else {
        toast({ title: "No Changes", description: "The provided information is the same as current." });
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const onChangePasswordSubmit: SubmitHandler<ChangePasswordFormInputs> = async (data) => {
    if (!user || !auth.currentUser || !user.email) {
      toast({ title: "Error", description: "User not authenticated or email missing.", variant: "destructive" });
      return;
    }
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, data.newPassword);
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
      resetPasswordForm();
    } catch (error: any) {
      let errorMessage = "Could not change password.";
      if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect current password. Please try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }
      toast({
        title: "Password Change Failed",
        description: error.message || errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 md:px-6 lg:px-8 flex flex-col items-center justify-center flex-1">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 flex flex-col items-center justify-center flex-1 py-8">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-4 inline-flex mx-auto">
            <UserAvatar 
              user={{ 
                displayName: user.profile?.displayName, 
                photoURL: currentPhotoURL || user.profile?.photoURL
              }} 
              size={24} 
              className="h-24 w-24" 
            />
          </div>
          <CardTitle className="text-3xl">{user.profile?.displayName || "User Profile"}</CardTitle>
          <CardDescription>
            Manage your display name, avatar URL, and other settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your display name"
                  {...registerProfile("displayName")}
                  className="pl-10"
                  aria-invalid={profileErrors.displayName ? "true" : "false"}
                />
              </div>
              {profileErrors.displayName && <p className="text-sm text-destructive">{profileErrors.displayName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="photoURL">Avatar URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="photoURL"
                  type="url"
                  placeholder="https://example.com/your-avatar.png"
                  {...registerProfile("photoURL")}
                  className="pl-10"
                  aria-invalid={profileErrors.photoURL ? "true" : "false"}
                />
              </div>
              {profileErrors.photoURL && <p className="text-sm text-destructive">{profileErrors.photoURL.message}</p>}
               <p className="text-xs text-muted-foreground">Enter a publicly accessible URL for your avatar image. Leave blank to remove current avatar.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={user.email || "No email provided"}
                  readOnly
                  disabled
                  className="pl-10 bg-muted/50 cursor-not-allowed"
                />
              </div>
               <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
            </div>
            
            <CardFooter className="px-0 pt-6">
                 <Button type="submit" className="w-full" disabled={isSubmittingProfile || !isProfileDirty}>
                {isSubmittingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Profile...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
          
          <Separator className="my-8" />

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground flex items-center">
                <ShieldCheck className="mr-2 h-6 w-6 text-primary" />
                Account Settings
            </h3>
            <form onSubmit={handleSubmitPasswordChange(onChangePasswordSubmit)} className="space-y-6 p-6 border rounded-lg bg-muted/30">
                <CardTitle className="text-lg mb-4">Change Password</CardTitle>
                <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                        <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Your current password"
                        {...registerPassword("currentPassword")}
                        className="pl-10"
                        aria-invalid={passwordErrors.currentPassword ? "true" : "false"}
                        />
                    </div>
                    {passwordErrors.currentPassword && <p className="text-sm text-destructive">{passwordErrors.currentPassword.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                        id="newPassword"
                        type="password"
                        placeholder="Your new password"
                        {...registerPassword("newPassword")}
                        className="pl-10"
                        aria-invalid={passwordErrors.newPassword ? "true" : "false"}
                        />
                    </div>
                    {passwordErrors.newPassword && <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                        id="confirmNewPassword"
                        type="password"
                        placeholder="Confirm your new password"
                        {...registerPassword("confirmNewPassword")}
                        className="pl-10"
                        aria-invalid={passwordErrors.confirmNewPassword ? "true" : "false"}
                        />
                    </div>
                    {passwordErrors.confirmNewPassword && <p className="text-sm text-destructive">{passwordErrors.confirmNewPassword.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                    </>
                    ) : (
                    "Change Password"
                    )}
                </Button>
            </form>
             <p className="text-xs text-muted-foreground px-1">
                Other account management options like deleting your account may be added here in the future.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

