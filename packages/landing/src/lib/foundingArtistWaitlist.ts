import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

const WAITLIST_EMAIL_STORAGE_KEY = 'indii_founding_artist_email';
const WAITLIST_MILESTONE_CONSENT_STORAGE_KEY = 'indii_founding_artist_milestones';
const WAITLIST_SOURCE_STORAGE_KEY = 'indii_founding_artist_source';

export interface FoundingArtistEnrollmentResult {
  status: 'waitlisted';
  queuePosition: number;
  alreadyJoined: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireFirebase() {
  if (!auth || !functions) throw new Error('The Founding Artist signup service is unavailable. Please try again later.');
  return { firebaseAuth: auth, firebaseFunctions: functions };
}

export function isCompletingFoundingArtistLink(): boolean {
  return Boolean(auth && typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href));
}

export function getStoredFoundingArtistEmail(): string | null {
  try {
    return localStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredMilestoneConsent(): boolean {
  try {
    return localStorage.getItem(WAITLIST_MILESTONE_CONSENT_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function getStoredWaitlistSource(): 'landing_page' | 'free_demo' {
  try {
    const stored = localStorage.getItem(WAITLIST_SOURCE_STORAGE_KEY);
    return stored === 'free_demo' ? 'free_demo' : 'landing_page';
  } catch {
    return 'landing_page';
  }
}

async function finalizeEnrollment(
  majorMilestoneUpdates: boolean,
  source: 'landing_page' | 'free_demo' = 'landing_page',
): Promise<FoundingArtistEnrollmentResult> {
  const { firebaseFunctions } = requireFirebase();
  const callable = httpsCallable<
    { source: 'landing_page' | 'free_demo'; majorMilestoneUpdates: boolean },
    FoundingArtistEnrollmentResult
  >(firebaseFunctions, 'joinFoundingArtistWaitlist');
  const response = await callable({ source, majorMilestoneUpdates });
  return response.data;
}

export async function beginFoundingArtistVerification(
  email: string,
  majorMilestoneUpdates: boolean,
  source: 'landing_page' | 'free_demo' = 'landing_page',
): Promise<void> {
  const { firebaseAuth } = requireFirebase();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Enter an email address.');

  try {
    localStorage.setItem(WAITLIST_EMAIL_STORAGE_KEY, normalizedEmail);
    localStorage.setItem(WAITLIST_MILESTONE_CONSENT_STORAGE_KEY, String(majorMilestoneUpdates));
    localStorage.setItem(WAITLIST_SOURCE_STORAGE_KEY, source);
  } catch {
    // The email can be entered again after the link opens if storage is blocked.
  }

  const isManagingUpdates = new URLSearchParams(window.location.search).get('manageUpdates') === 'true';
  const completionQuery = isManagingUpdates
    ? '?completeWaitlist=true&manageUpdates=true'
    : '?completeWaitlist=true';
  await sendSignInLinkToEmail(firebaseAuth, normalizedEmail, {
    url: `${window.location.origin}/${completionQuery}#waitlist`,
    handleCodeInApp: true,
  });
}

export async function completeFoundingArtistVerification(
  email: string,
  majorMilestoneUpdates: boolean,
  source?: 'landing_page' | 'free_demo',
): Promise<FoundingArtistEnrollmentResult> {
  const { firebaseAuth } = requireFirebase();
  if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) {
    throw new Error('This verification link is invalid or has expired. Request a new link.');
  }

  const effectiveSource = source || getStoredWaitlistSource();
  const normalizedEmail = normalizeEmail(email);
  const credential = await signInWithEmailLink(firebaseAuth, normalizedEmail, window.location.href);
  await credential.user.getIdToken(true);
  if (!credential.user.emailVerified) {
    throw new Error('Firebase did not verify this email address. Request a new link.');
  }

  try {
    localStorage.removeItem(WAITLIST_EMAIL_STORAGE_KEY);
    localStorage.removeItem(WAITLIST_MILESTONE_CONSENT_STORAGE_KEY);
    localStorage.removeItem(WAITLIST_SOURCE_STORAGE_KEY);
  } catch {
    // A blocked storage cleanup must not invalidate a verified enrollment.
  }
  return finalizeEnrollment(majorMilestoneUpdates, effectiveSource);
}

export async function enrollCurrentVerifiedArtist(
  email: string,
  majorMilestoneUpdates: boolean,
  source: 'landing_page' | 'free_demo' = 'landing_page',
): Promise<FoundingArtistEnrollmentResult | null> {
  const { firebaseAuth } = requireFirebase();
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser?.emailVerified || normalizeEmail(currentUser.email ?? '') !== normalizeEmail(email)) {
    return null;
  }
  await currentUser.getIdToken(true);
  return finalizeEnrollment(majorMilestoneUpdates, source);
}
