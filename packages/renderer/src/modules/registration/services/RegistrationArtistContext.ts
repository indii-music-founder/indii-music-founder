import { contextForRegistration, projectLegacyArtistContext, type DepartmentArtistContext } from '@indii/shared';
import type { UserProfile } from '@/types/User';

/** Registration reads the shared profile context; it never promotes a declared PRO into verified authority. */
export function getRegistrationArtistContext(profile: UserProfile, observedAt = new Date().toISOString()): DepartmentArtistContext {
  return contextForRegistration(profile.artistContext ?? projectLegacyArtistContext(profile, observedAt));
}
