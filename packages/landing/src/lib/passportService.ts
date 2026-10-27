import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { CampaignAttribution } from './nowWhatCampaign';
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
  campaign?: CampaignAttribution;
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
        ...(options.campaign && Object.keys(options.campaign).length ? { campaign: options.campaign } : {}),
        claimedByUid: null,
      };

      if (options.artistName) data.artistName = options.artistName;
      if (options.email) data.email = options.email.trim().toLowerCase();
      if (options.marketingConsent !== undefined) data.marketingConsent = Boolean(options.marketingConsent);
      if (options.assessmentConsent !== undefined) data.assessmentConsent = Boolean(options.assessmentConsent);

      const existing = await getDoc(docRef);
      if (!existing.exists()) await setDoc(docRef, data);
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
  if (!db || !assessmentId) throw new Error('Report requests are unavailable. Please try again later.');

  try {
    const docRef = doc(db, 'prospect_assessments', assessmentId);
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      throw new Error('Your Passport answers could not be found.');
    }
    const currentData = existing.data();
    if (currentData.claimedByUid != null) {
      throw new Error('This assessment has already been claimed.');
    }
    // Prevent modifying contact email once set (ISSUE-1526 anti-tamper / hijack)
    if (
      contact.email !== undefined &&
      currentData.email &&
      currentData.email.toLowerCase() !== contact.email.trim().toLowerCase()
    ) {
      throw new Error('The contact email for this assessment cannot be modified once set.');
    }

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
    if (err instanceof Error && err.message.includes('cannot be modified')) {
      throw err;
    }
    throw new Error('Your report request could not be saved. Please try again.');
  }
}

/**
 * Link an assessment to a newly created authenticated member account
 */
export async function claimProspectAssessment(
  assessmentId: string,
  uid: string,
  callerEmail?: string,
): Promise<void> {
  if (!db || !assessmentId || !uid) {
    throw new Error('Your Passport answers could not be linked. Please try again.');
  }

  const docRef = doc(db, 'prospect_assessments', assessmentId);
  const assessment = await getDoc(docRef);
  if (!assessment.exists()) {
    throw new Error('Your Passport answers could not be found. Please keep your report link.');
  }
  const data = assessment.data();
  const claimedByUid = data.claimedByUid;
  if (claimedByUid === uid) return;
  if (claimedByUid != null) {
    throw new Error('These Passport answers are already linked to another account.');
  }

  // Enforce trusted ownership if assessment is bound to an email (ISSUE-1526)
  if (data.email && callerEmail && data.email.toLowerCase() !== callerEmail.trim().toLowerCase()) {
    throw new Error('These Passport answers were created for a different email address.');
  }

  await updateDoc(docRef, {
    claimedByUid: uid,
    claimedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
