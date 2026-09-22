import { describe, expect, it } from 'vitest';
import { getRegistrationArtistContext } from './RegistrationArtistContext';

describe('RegistrationArtistContext', () => {
  it('uses legacy context but requires confirmation for authoritative registrations', () => {
    const view = getRegistrationArtistContext({ careerStage: 'Established', goals: ['Touring'], brandKit: { socials: { pro: 'BMI' } } } as never, '2026-09-21T20:00:00.000Z');
    expect(view.guidance.careerStage).toBe('Established');
    expect(view.known['registrations.pro']?.value).toBe('BMI');
    expect(view.authoritative['registrations.pro']).toBeUndefined();
    expect(view.needsConfirmation).toContain('registrations.pro');
  });
});
