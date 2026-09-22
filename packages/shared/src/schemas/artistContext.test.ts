import { describe, expect, it } from 'vitest';
import {
  ArtistContextSchema,
  contextForDistribution,
  contextForRegistration,
  declaredContextFact,
  isAuthoritativeContextFact,
  mergeArtistContext,
  projectLegacyArtistContext,
} from './artistContext.js';

const now = '2026-09-21T20:00:00.000Z';

describe('ArtistContext', () => {
  it.each([
    ['new artist', {}],
    ['experienced artist', { careerStage: 'Industry veteran' }],
    ['DJ/producer hybrid', { artistType: 'DJ / Producer' }],
    ['singer-songwriter', { artistType: 'Singer-songwriter' }],
    ['band', { artistType: 'Band' }],
    ['label manager', { artistType: 'Label manager' }],
    ['incomplete onboarding', { goals: [] }],
    ['imported legacy user', { careerProfile: 'Ten years of releases' }],
  ])('accepts the %s compatibility fixture without inventing facts', (_name, profile) => {
    expect(() => ArtistContextSchema.parse(projectLegacyArtistContext(profile, now))).not.toThrow();
  });

  it('safely maps legacy onboarding without inventing unknown values', () => {
    const context = projectLegacyArtistContext({ careerStage: 'Building momentum', goals: ['Touring'] }, now);
    expect(ArtistContextSchema.parse(context)).toEqual(context);
    expect(context.facts['experience.careerStage']?.provenance.state).toBe('USER_DECLARED');
    expect(context.facts['infrastructure.distributor']).toBeUndefined();
  });

  it('keeps inferred or declared registrations out of authoritative facts', () => {
    const context = projectLegacyArtistContext({ brandKit: { socials: { pro: 'ASCAP' } } }, now);
    const view = contextForRegistration(context);
    expect(view.known['registrations.pro']?.value).toBe('ASCAP');
    expect(view.authoritative['registrations.pro']).toBeUndefined();
    expect(view.needsConfirmation).toContain('registrations.pro');
    expect(isAuthoritativeContextFact(context.facts['registrations.pro'])).toBe(false);
  });

  it('allows a later human-confirmed correction to supersede an inference', () => {
    const inferred = {
      schemaVersion: 'artist-context.v1' as const,
      facts: {
        'identity.artistType': {
          key: 'identity.artistType', value: 'Solo', requiresHumanConfirmation: true,
          provenance: { state: 'INFERRED' as const, sourceType: 'AGENT' as const, evidence: [], observedAt: now, confidence: 0.6 },
        },
      },
      updatedAt: now,
    };
    const confirmedAt = '2026-09-21T21:00:00.000Z';
    const corrected = {
      schemaVersion: 'artist-context.v1' as const,
      facts: {
        'identity.artistType': {
          key: 'identity.artistType', value: 'Band', requiresHumanConfirmation: false,
          provenance: { state: 'USER_CONFIRMED' as const, sourceType: 'USER' as const, evidence: [], observedAt: confirmedAt, confirmedAt },
        },
      },
      updatedAt: confirmedAt,
    };
    const merged = mergeArtistContext(inferred, corrected);
    expect(merged.facts['identity.artistType']?.value).toBe('Band');
    expect(isAuthoritativeContextFact(merged.facts['identity.artistType'])).toBe(true);
  });

  it('does not downgrade a confirmed fact during a later legacy projection', () => {
    const confirmedAt = '2026-09-21T21:00:00.000Z';
    const confirmed = ArtistContextSchema.parse({
      schemaVersion: 'artist-context.v1',
      facts: {
        'experience.careerStage': {
          key: 'experience.careerStage', value: 'Established', requiresHumanConfirmation: false,
          provenance: { state: 'USER_CONFIRMED', sourceType: 'USER', evidence: [], observedAt: confirmedAt, confirmedAt },
        },
      },
      updatedAt: confirmedAt,
    });
    const projected = projectLegacyArtistContext({ careerStage: 'Established' }, '2026-09-21T22:00:00.000Z');
    const merged = mergeArtistContext(confirmed, projected);
    expect(merged.facts['experience.careerStage']?.provenance.state).toBe('USER_CONFIRMED');
  });

  it('gives registration and distribution consistent shared guidance', () => {
    const context = projectLegacyArtistContext({ careerStage: 'Established', goals: ['Sync licensing'], brandKit: { socials: { distributor: 'TuneCore' } } }, now);
    expect(contextForRegistration(context).guidance).toEqual(contextForDistribution(context).guidance);
    expect(contextForDistribution(context).known['infrastructure.distributor']?.value).toBe('TuneCore');
  });

  it('rejects a fact whose embedded key differs from its map key', () => {
    const fact = declaredContextFact('goals.current', ['Touring'], now);
    expect(() => ArtistContextSchema.parse({ schemaVersion: 'artist-context.v1', facts: { wrong: fact }, updatedAt: now })).toThrow();
  });
});
