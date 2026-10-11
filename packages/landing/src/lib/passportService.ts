import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { PassportAnswers } from './passportEvaluator';

export const PASSPORT_ID_STORAGE_KEY = 'indii_passport_id';
export const PASSPORT_DRAFT_STORAGE_KEY = 'indii_passport_draft';
export const PASSPORT_STEP_STORAGE_KEY = 'indii_passport_step';

/**
 * Generate a client UUID v4
 */
export function generateAssessmentId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the currently active assessment ID from query params or session storage
 */
export function getActiveAssessmentId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromParam = searchParams.get('assessmentId');
    if (fromParam) return fromParam;
    return sessionStorage.getItem(PASSPORT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface SaveAssessmentOptions {
  source?: string;
  artistName?: string;
  email?: string;
  marketingConsent?: boolean;
  assessmentConsent?: boolean;
}

/**
 * Save an anonymous assessment to Firestore (/prospect_assessments/{assessmentId})
 * Falls back silently to session storage if Firestore is unreachable or offline.
 */
export async function saveProspectAssessment(
  answers: PassportAnswers,
  options: SaveAssessmentOptions = {},
): Promise<string> {
  let assessmentId = getActiveAssessmentId();
  if (!assessmentId) {
    assessmentId = generateAssessmentId();
    try {
      sessionStorage.setItem(PASSPORT_ID_STORAGE_KEY, assessmentId);
    } catch {
      // Ignore storage errors
    }
  }

  // Always keep local session draft updated
  try {
    sessionStorage.setItem(PASSPORT_DRAFT_STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // Ignore
  }

  // Attempt Firestore sync if available
  if (db) {
    try {
      const docRef = doc(db, 'prospect_assessments', assessmentId);
      const data: Record<string, unknown> = {
        id: assessmentId,
        createdAt: serverTimestamp(),
        clientSessionId: assessmentId,
        careerStage: answers.careerStage,
        genre: answers.genre,
        customGenre: (answers.customGenre ?? '').trim().slice(0, 80),
        proAffiliation: answers.proAffiliation,
        mlcRegistered: answers.mlcRegistered,
        distributor: answers.distributor,
        releaseStatus: answers.releaseStatus,
        goals: answers.goals.slice(0, 2),
        source: options.source || 'passport_organic',
        claimedByUid: null,
      };

      if (options.artistName) data.artistName = options.artistName;
      if (options.email) data.email = options.email.trim().toLowerCase();
      if (options.marketingConsent !== undefined) data.marketingConsent = Boolean(options.marketingConsent);
      if (options.assessmentConsent !== undefined) data.assessmentConsent = Boolean(options.assessmentConsent);

      await setDoc(docRef, data, { merge: true });
    } catch (err) {
      console.warn('[ArtistPassport] Firestore intake deferred or offline:', err);
    }
  }

  return assessmentId;
}

/**
 * Update optional contact info on an existing assessment
 */
export async function updateAssessmentContact(
  assessmentId: string,
  contact: {
    artistName?: string;
    email?: string;
    marketingConsent?: boolean;
    assessmentConsent?: boolean;
  },
): Promise<void> {
  if (!db || !assessmentId) return;

  try {
    const docRef = doc(db, 'prospect_assessments', assessmentId);
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (contact.artistName !== undefined) updates.artistName = contact.artistName;
    if (contact.email !== undefined) updates.email = contact.email.trim().toLowerCase();
    if (contact.marketingConsent !== undefined) updates.marketingConsent = Boolean(contact.marketingConsent);
    if (contact.assessmentConsent !== undefined) updates.assessmentConsent = Boolean(contact.assessmentConsent);

    await updateDoc(docRef, updates);
  } catch (err) {
    console.warn('[ArtistPassport] Contact update deferred:', err);
  }
}

/**
 * Link an assessment to a newly created authenticated member account
 */
export async function claimProspectAssessment(
  assessmentId: string,
  uid: string,
): Promise<void> {
  if (!db || !assessmentId || !uid) return;

  try {
    const docRef = doc(db, 'prospect_assessments', assessmentId);
    await updateDoc(docRef, {
      claimedByUid: uid,
      claimedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[ArtistPassport] Claim linking deferred:', err);
  }
}

/**
 * Fetch a prospect assessment (used by studio or signup flow)
 */
export async function getProspectAssessment(assessmentId: string) {
  if (!db || !assessmentId) return null;

  try {
    const docRef = doc(db, 'prospect_assessments', assessmentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[ArtistPassport] Failed to fetch assessment:', err);
  }
  return null;
}
