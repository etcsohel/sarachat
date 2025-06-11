
"use client";

import type { ReactNode } from "react";
import React, { createContext, useState, useEffect, useMemo } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import type { UserProfile, AuthUser } from "@/types";
import { getUserProfile, createUserProfile, updateUserProfile } from "@/lib/firebase/firestore";
import { generateRsaKeyPair, exportKeyToJwk } from "@/lib/crypto";
import { storePrivateKey, getPrivateKey, storePublicKey, getPublicKey } from "@/lib/indexedDB";
// import { Loader2 } from "lucide-react"; // Temporarily remove for debugging

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  userKeys: { publicKey: JsonWebKey | null; privateKey: CryptoKey | null } | null;
  ensureKeys: () => Promise<void>;
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

      if (localPrivateKey && localPublicKeyJwk) {
        setUserKeys({ privateKey: localPrivateKey, publicKey: localPublicKeyJwk });
        let profileToUpdate = currentUserForKeys.profile;
        if (!profileToUpdate) {
            profileToUpdate = await getUserProfile(currentUserForKeys.uid);
        }

        if (profileToUpdate && (!profileToUpdate.publicKey || JSON.stringify(profileToUpdate.publicKey) !== JSON.stringify(localPublicKeyJwk))) {
            console.log("AuthContext: Updating Firestore profile with locally found public key for user:", currentUserForKeys.uid);
            await updateUserProfile(currentUserForKeys.uid, { publicKey: localPublicKeyJwk });
            const refreshedProfile = await getUserProfile(currentUserForKeys.uid);
            if (refreshedProfile) {
                if (user && user.uid === currentUserForKeys.uid) {
                    setUser(prev => prev ? ({ ...prev, profile: refreshedProfile }) : null);
                }
            }
        }
        return;
      }
      
      let userProfileForKeys = currentUserForKeys.profile;
      if (!userProfileForKeys) {
        const profileData = await getUserProfile(currentUserForKeys.uid);
        if (profileData) userProfileForKeys = profileData;
      }

      if (userProfileForKeys?.publicKey && !localPrivateKey) {
        console.warn("AuthContext: Public key found in Firestore, but private key missing locally. Re-generating keys for this device.");
      }

      console.log("AuthContext: Generating new key pair for user:", currentUserForKeys.uid);
      const { publicKey: newPublicKeyCrypto, privateKey: newPrivateKeyCrypto } = await generateRsaKeyPair();
      const newPublicKeyJwk = await exportKeyToJwk(newPublicKeyCrypto);

      await storePrivateKey(currentUserForKeys.uid, newPrivateKeyCrypto);
      await storePublicKey(currentUserForKeys.uid, newPublicKeyJwk);
      setUserKeys({ privateKey: newPrivateKeyCrypto, publicKey: newPublicKeyJwk });

      console.log("AuthContext: Updating/Creating Firestore profile with new public key for user:", currentUserForKeys.uid);
      let updatedProfile;
      if (userProfileForKeys) {
        await updateUserProfile(currentUserForKeys.uid, { publicKey: newPublicKeyJwk });
        updatedProfile = await getUserProfile(currentUserForKeys.uid); 
      } else {
        updatedProfile = await createUserProfile(currentUserForKeys, newPublicKeyJwk, currentUserForKeys.displayName || undefined);
      }
      
      if (user && user.uid === currentUserForKeys.uid) {
         setUser(prevUser => prevUser ? { ...prevUser, profile: updatedProfile || prevUser.profile } : null);
      } else if (authUserParam && authUserParam.uid === currentUserForKeys.uid) {
        // Profile will be attached in onAuthStateChanged
      }

    } catch (err) {
      console.error("AuthContext: Error managing user keys:", err);
      setError(err instanceof Error ? err : new Error("Failed to manage keys"));
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true); 
      setError(null);
      if (firebaseUser) {
        try {
          let profile = await getUserProfile(firebaseUser.uid);
          const authUser: AuthUser = { ...firebaseUser, profile: profile || undefined };
          setUser(authUser); 
          await ensureKeys(authUser); 

           const finalProfile = await getUserProfile(firebaseUser.uid);
           setUser(prev => prev ? {...prev, profile: finalProfile || prev.profile} : null);

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
      <div className="flex h-screen w-screen items-center justify-center">
        {/* <Loader2 className="h-12 w-12 animate-spin text-primary" /> */}
        <p className="text-lg">Initializing (Server/Initial Client)...</p>
      </div>
    );
  }

  if (loading && !user) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        {/* <Loader2 className="h-12 w-12 animate-spin text-primary" /> */}
        <p className="text-lg">Loading User Data (Client)...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
