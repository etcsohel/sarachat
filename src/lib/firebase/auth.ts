import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile as updateFirebaseProfile,
  type UserCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./firebase";
import { createUserProfile, getUserProfile } from "./firestore"; // Assuming these are in firestore.ts
import type { UserProfile } from "@/types";
import { generateRsaKeyPair, exportKeyToJwk } from "@/lib/crypto";
import { storePrivateKey, storePublicKey } from "@/lib/indexedDB";


// Sign Up with Email and Password
export async function signUpWithEmail(email: string, password_1: string, displayName: string): Promise<FirebaseUser> {
  const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password_1);
  const user = userCredential.user;

  // Generate keys
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const publicKeyJwk = await exportKeyToJwk(publicKey);

  // Store keys
  await storePrivateKey(user.uid, privateKey);
  await storePublicKey(user.uid, publicKeyJwk);
  
  // Update Firebase Auth profile
  await updateFirebaseProfile(user, { displayName });

  // Create user profile in Firestore with public key
  await createUserProfile(user, publicKeyJwk, displayName);
  
  return user;
}

// Sign In with Email and Password
export async function signInWithEmail(email: string, password_1: string): Promise<FirebaseUser> {
  const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password_1);
  // Key check/generation handled by AuthContext
  return userCredential.user;
}

// Sign In with Google
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if user profile exists, if not, create it
  let profile = await getUserProfile(user.uid);
  if (!profile) {
    // Generate keys for new OAuth user
    const { publicKey, privateKey } = await generateRsaKeyPair();
    const publicKeyJwk = await exportKeyToJwk(publicKey);
    await storePrivateKey(user.uid, privateKey);
    await storePublicKey(user.uid, publicKeyJwk);
    await createUserProfile(user, publicKeyJwk);
  } else if (!profile.publicKey) {
    // Profile exists but no public key, generate and update
    const { publicKey, privateKey } = await generateRsaKeyPair();
    const publicKeyJwk = await exportKeyToJwk(publicKey);
    await storePrivateKey(user.uid, privateKey);
    await storePublicKey(user.uid, publicKeyJwk);
    // This needs an updateUserProfile function in firestore.ts
    // await updateUserProfile(user.uid, { publicKey: publicKeyJwk }); 
    console.warn("User profile existed without public key. Generated and stored. Implement updateUserProfile.");
  }
  // Further key checks handled by AuthContext
  return user;
}

// Sign Out
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Wrapper for onAuthStateChanged to be used in AuthContext
export function onAuthUserChanged(callback: (user: FirebaseUser | null) => void) {
  return auth.onAuthStateChanged(callback);
}
