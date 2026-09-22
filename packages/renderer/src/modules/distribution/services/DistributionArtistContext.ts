import { contextForDistribution, projectLegacyArtistContext, type DepartmentArtistContext } from '@indii/shared';
import type { UserProfile } from '@/types/User';

/** Distribution consumes the same context and legacy projection as Registration. */
export function getDistributionArtistContext(profile: UserProfile, observedAt = new Date().toISOString()): DepartmentArtistContext {
  return contextForDistribution(profile.artistContext ?? projectLegacyArtistContext(profile, observedAt));
}
