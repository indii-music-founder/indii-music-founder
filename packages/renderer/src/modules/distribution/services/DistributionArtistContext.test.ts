import { describe, expect, it } from 'vitest';
import { getDistributionArtistContext } from './DistributionArtistContext';

describe('DistributionArtistContext', () => {
  it('reuses distributor context without duplicating the profile model', () => {
    const view = getDistributionArtistContext({ careerStage: 'Building momentum', goals: ['Get playlisted'], brandKit: { socials: { distributor: 'DistroKid' } } } as never, '2026-09-21T20:00:00.000Z');
    expect(view.guidance.goals).toEqual(['Get playlisted']);
    expect(view.known['infrastructure.distributor']?.value).toBe('DistroKid');
  });
});
