import type { UserProfile } from '@/types/User';
import type { ProspectAssessment } from '@indii/shared';
import { logger } from '@/utils/logger';

/**
 * Maps a ProspectAssessment (from Artist Passport diagnostic) into a UserProfile.
 * Idempotent: does not overwrite existing non-empty profile fields.
 */
export function mapAssessmentToProfile(
  profile: UserProfile,
  assessment: Partial<ProspectAssessment>,
): UserProfile {
  const updatedBrandKit = { ...profile.brandKit };
  const updatedReleaseDetails = { ...updatedBrandKit.releaseDetails };
  const updatedSocials = { ...updatedBrandKit.socials };

  // 1. Career stage
  const careerStage = profile.careerStage || assessment.careerStage || '';

  // 2. Goals (up to 2 choices from assessment)
  const existingGoals = profile.goals || [];
  const goals = existingGoals.length > 0 ? existingGoals : (assessment.goals || []);

  // 3. Genre
  if (!updatedReleaseDetails.genre && assessment.genre) {
    updatedReleaseDetails.genre = assessment.genre;
  }

  // 4. Distributor & PRO
  if (!updatedSocials.distributor && assessment.distributor) {
    updatedSocials.distributor = assessment.distributor;
  }
  if (!updatedSocials.pro && assessment.proAffiliation) {
    updatedSocials.pro = assessment.proAffiliation;
  }

  updatedBrandKit.releaseDetails = updatedReleaseDetails;
  updatedBrandKit.socials = updatedSocials;

  return {
    ...profile,
    careerStage,
    goals,
    brandKit: updatedBrandKit,
  };
}

/**
 * Hydrates UserProfile from an Artist Passport assessment if profile is still blank.
 */
export async function hydrateProfileWithAssessment(
  profile: UserProfile,
  assessmentId?: string,
): Promise<UserProfile> {
  // If careerStage and genre are already configured, profile is already hydrated
  if (profile.careerStage && profile.brandKit?.releaseDetails?.genre) {
    return profile;
  }

  let targetId = assessmentId;
  if (!targetId && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    targetId = params.get('assessmentId') || undefined;
  }

  if (!targetId) {
    return profile;
  }

  try {
    const { db } = await import('@/services/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'prospect_assessments', targetId));
    if (snap.exists()) {
      const data = snap.data() as ProspectAssessment;
      logger.info('[PassportHydration] Successfully hydrated profile from assessment:', targetId);
      return mapAssessmentToProfile(profile, data);
    }
  } catch (err: unknown) {
    logger.warn('[PassportHydration] Unable to load prospect assessment:', err);
  }

  return profile;
}
