import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  // signInWithRedirect,
  // getRedirectResult,
  // GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  type User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

// Studio app URL for refunds after auth
const STUDIO_URL = process.env.NEXT_PUBLIC_STUDIO_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:4242' : 'https://indiios-studio.web.app');

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await updateLastLogin(result.user.uid);
  return result.user;
}

/**
 * Create new account with email and password
 */
export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  // Update display name
  await updateProfile(result.user, { displayName });

  // Force token refresh to ensure Firestore picks up the new auth state
  await result.user.getIdToken(true);

  // Create user document in Firestore
  await createUserDocument(result.user, displayName);

  // Send verification email
  await sendEmailVerification(result.user);

  return result.user;
}

/**
 * Sign out current user
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Create user document in Firestore
 */
async function createUserDocument(user: User, displayName?: string) {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: displayName || user.displayName || 'Anonymous',
    photoURL: user.photoURL || null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    tier: 'free'
  });
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(uid: string) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
}

/**
 * Get redirect URL for studio app
 */
export function getStudioUrl() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4242';
  }
  return STUDIO_URL;
}
