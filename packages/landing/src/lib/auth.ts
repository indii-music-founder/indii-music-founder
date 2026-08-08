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
const STUDIO_URL = import.meta.env.VITE_STUDIO_URL || (import.meta.env.DEV ? 'http://localhost:4242' : 'https://indii.music');

function isLocalLandingDevHost() {
  return (
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const firebaseAuth = auth;
  if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
  const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
  await updateLastLogin(result.user.uid);
  return result.user;
}

/**
 * Create new account with email and password
 */
export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const firebaseAuth = auth;
  if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
  const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);

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
 * Reload the authenticated account from Firebase Auth before treating an email
 * as verified. The local User object can retain an old verification claim after
 * the user clicks the verification link in another tab or device.
 */
export async function refreshEmailVerification(user?: User): Promise<boolean> {
  const currentUser = user || auth?.currentUser;
  if (!currentUser) throw new Error('No authenticated user is available to verify.');
  await currentUser.reload();
  await currentUser.getIdToken(true);
  return currentUser.emailVerified;
}

/** Send a new verification link only for the currently authenticated account. */
export async function resendEmailVerification(): Promise<void> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('No authenticated user is available to verify.');
  await currentUser.reload();
  if (!currentUser.emailVerified) {
    await sendEmailVerification(currentUser);
  }
}

/**
 * Sign out current user
 */
export async function logOut() {
  const firebaseAuth = auth;
  if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
  await signOut(firebaseAuth);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const firebaseAuth = auth;
  if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
  await sendPasswordResetEmail(firebaseAuth, email);
}

/**
 * Create user document in Firestore
 */
async function createUserDocument(user: User, displayName?: string) {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: displayName || user.displayName || 'Anonymous',
    photoURL: user.photoURL || null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(uid: string) {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
}

/**
 * Get redirect URL for studio app.
 * Appends ?source=founder when the visitor is on the founder domain or VITE_FOUNDER_MODE is set,
 * so the app auth screen can show founder-contextual copy and trigger the guided walkthrough.
 */
export function getStudioUrl() {
  const isFounderDomain =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('founder') ||
      import.meta.env.VITE_FOUNDER_MODE === 'true' ||
      window.location.search.includes('founder=true'));

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return isFounderDomain ? 'http://localhost:4242?source=founder' : 'http://localhost:4242';
  }

  return isFounderDomain ? `${STUDIO_URL}?source=founder` : STUDIO_URL;
}

/**
 * Public Founder-preview destination.
 * Opens the canonical Studio without carrying Founder routing state into the new tab.
 */
export function getStudioPreviewUrl() {
  if (isLocalLandingDevHost()) {
    return 'http://localhost:4242';
  }
  return STUDIO_URL;
}
