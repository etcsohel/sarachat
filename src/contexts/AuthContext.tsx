
"use client";

import type { ReactNode } from "react";
import React, { createContext, useState, useEffect, useMemo } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import type { UserProfile, AuthUser } from "@/types";
import { getUserProfile, createUserProfile, updateUserProfile } from "@/lib/firebase/firestore";
import { generateRsaKeyPair, exportKeyToJwk } from "@/lib/crypto";
import { storePrivateKey, getPrivateKey, storePublicKey, getPublicKey } from "@/lib/indexedDB";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  userKeys: { publicKey: JsonWebKey | null; privateKey: CryptoKey | null } | null;
  ensureKeys: (isManualTrigger?: boolean) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading state
  const [error, setError] = useState<Error | null>(null);
  const [userKeys, setUserKeys] = useState<{ publicKey: JsonWebKey | null; privateKey: CryptoKey | null } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const ensureKeys = async (authUserParam?: AuthUser | null) => {
    const currentUserForKeys = authUserParam || user;
    if (!currentUserForKeys) return;

    try {
      let localPrivateKey = await getPrivateKey(currentUserForKeys.uid);
      let localPublicKeyJwk = await getPublicKey(currentUserForKeys.uid);
      let firestorePublicKeyJwk: JsonWebKey | undefined = undefined;

      let userProfileForKeys = currentUserForKeys.profile;
      if (!userProfileForKeys) { // Fetch profile if not already part of authUserParam or current user state
        userProfileForKeys = await getUserProfile(currentUserForKeys.uid);
      }
      if (userProfileForKeys?.publicKey) {
        firestorePublicKeyJwk = userProfileForKeys.publicKey;
      }

      if (localPrivateKey && localPublicKeyJwk) {
        // Scenario 1: Keys found locally. This device's keys are primary.
        setUserKeys({ privateKey: localPrivateKey, publicKey: localPublicKeyJwk });

        // Ensure Firestore has this local public key if it's missing or different.
        if (!firestorePublicKeyJwk || JSON.stringify(firestorePublicKeyJwk) !== JSON.stringify(localPublicKeyJwk)) {
          console.log(`AuthContext: Updating Firestore public key for user ${currentUserForKeys.uid} to match local key.`);
          await updateUserProfile(currentUserForKeys.uid, { publicKey: localPublicKeyJwk });
          
          const refreshedProfile = await getUserProfile(currentUserForKeys.uid);
          if (user && user.uid === currentUserForKeys.uid) { // Update current user state if it's the active user
            setUser(prev => prev ? ({ ...prev, profile: refreshedProfile || prev.profile }) : null);
          } else if (authUserParam && authUserParam.uid === currentUserForKeys.uid) { // Update authUserParam if it was passed
             if(refreshedProfile) authUserParam.profile = refreshedProfile;
          }
        }
        return; // Local keys are good and synced.
      }

      // Scenario 2: Local private key is missing.
      if (firestorePublicKeyJwk) {
        // Public key exists in Firestore. Use it. Private key for this device is considered lost/not present.
        console.warn(`AuthContext: Public key for user ${currentUserForKeys.uid} found in Firestore, but private key is missing locally on this device. Decryption/Encryption may not be possible from this device.`);
        setUserKeys({ privateKey: null, publicKey: firestorePublicKeyJwk });
        // If local public key store was somehow out of sync or empty, ensure it stores the Firestore one.
        if (!localPublicKeyJwk || JSON.stringify(localPublicKeyJwk) !== JSON.stringify(firestorePublicKeyJwk)) {
            await storePublicKey(currentUserForKeys.uid, firestorePublicKeyJwk);
        }
        return;
      }

      // Scenario 3: No keys locally AND no public key in Firestore.
      // This indicates a fresh setup for the user or keys were wiped from all known sources.
      console.log("AuthContext: No local keys and no public key in Firestore. Generating new key pair for user:", currentUserForKeys.uid);
      const { publicKey: newPublicKeyCrypto, privateKey: newPrivateKeyCrypto } = await generateRsaKeyPair();
      const newGeneratedPublicKeyJwk = await exportKeyToJwk(newPublicKeyCrypto);

      await storePrivateKey(currentUserForKeys.uid, newPrivateKeyCrypto);
      await storePublicKey(currentUserForKeys.uid, newGeneratedPublicKeyJwk);
      setUserKeys({ privateKey: newPrivateKeyCrypto, publicKey: newGeneratedPublicKeyJwk });

      // Update/Create Firestore profile with the new public key
      let finalProfileAfterKeyGen;
      if (userProfileForKeys) { // Profile exists but didn't have a public key
        await updateUserProfile(currentUserForKeys.uid, { publicKey: newGeneratedPublicKeyJwk });
        finalProfileAfterKeyGen = await getUserProfile(currentUserForKeys.uid);
      } else { // No profile existed (or was fetched and was null)
        finalProfileAfterKeyGen = await createUserProfile(currentUserForKeys, newGeneratedPublicKeyJwk, currentUserForKeys.displayName || undefined);
      }
      
      if (user && user.uid === currentUserForKeys.uid) { // Update current user state
         setUser(prevUser => prevUser ? { ...prevUser, profile: finalProfileAfterKeyGen || prevUser.profile } : null);
      } else if (authUserParam && authUserParam.uid === currentUserForKeys.uid) { // Update authUserParam if it was passed
         if(finalProfileAfterKeyGen) authUserParam.profile = finalProfileAfterKeyGen;
      }

    } catch (err) {
      console.error("AuthContext: Error managing user keys:", err);
      setError(err instanceof Error ? err : new Error("Failed to manage keys"));
      setUserKeys(null); // Ensure keys are null on error to prevent inconsistent state
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true); 
      setError(null);
      if (firebaseUser) {
        try {
          // Fetch profile first, as ensureKeys might need it if not on firebaseUser.
          let profile = await getUserProfile(firebaseUser.uid);
          const authUser: AuthUser = { ...firebaseUser, profile: profile || undefined };
          
          await ensureKeys(authUser); // Pass the fetched authUser with its profile
          
          // Re-fetch profile after ensureKeys, as it might have updated it.
          const finalProfile = await getUserProfile(firebaseUser.uid);
          setUser({ ...authUser, profile: finalProfile || authUser.profile });

        } catch (err) {
          console.error("AuthContext: Error during auth state change processing:", err);
          setError(err instanceof Error ? err : new Error("Failed to load user session"));
          setUser(null); 
          setUserKeys(null);
        }
      } else {
        setUser(null);
        setUserKeys(null);
      }
      setLoading(false); 
    });

    return () => unsubscribe();
  }, []); 

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    userKeys,
    ensureKeys: () => ensureKeys(user), 
  }), [user, loading, error, userKeys]);

  if (!hasMounted) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg">Initializing SaraChat...</p>
      </div>
    );
  }

  if (loading && !user) { 
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg">Loading Session...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

