import { describe, expect, it } from 'vitest';
import {
  evaluateAITrainingExport,
  AITrainingGrantSchema,
  type AITrainingGrant,
} from './aiTrainingConsent.js';

describe('AI Training Consent and Export Gate (CI-V3-20261021-01)', () => {
  const sampleTermsHash = 'a'.repeat(64);
  const now = 1761652800000; // Fixed timestamp for deterministic testing
  const future = now + 365 * 86400 * 1000;

  const validGrantArtist1: AITrainingGrant = {
    grantId: 'grant-001',
    assetId: 'rec-123',
    assetType: 'master_recording',
    rightsholderEntityId: 'artist-alice',
    affirmativeOptIn: true,
    optInTimestamp: now - 10000,
    expiresAt: future,
    revokedAt: null,
    authorizedVendor: 'TrustedModelPartner',
    scopes: ['stem_separation_model', 'music_foundation_model'],
    compensation: {
      artistCents: 50000,
      platformCents: 15000,
      currency: 'USD',
      termsAgreementHash: sampleTermsHash,
      paidAt: now - 5000,
      payoutTransactionId: 'tx_payout_12345',
    },
    auditLogId: 'audit-log-001',
  };

  const validGrantArtist2: AITrainingGrant = {
    grantId: 'grant-002',
    assetId: 'rec-123',
    assetType: 'master_recording',
    rightsholderEntityId: 'artist-bob',
    affirmativeOptIn: true,
    optInTimestamp: now - 10000,
    expiresAt: future,
    revokedAt: null,
    authorizedVendor: 'TrustedModelPartner',
    scopes: ['stem_separation_model', 'music_foundation_model'],
    compensation: {
      artistCents: 50000,
      platformCents: 15000,
      currency: 'USD',
      termsAgreementHash: sampleTermsHash,
      paidAt: now - 5000,
      payoutTransactionId: 'tx_payout_67890',
    },
    auditLogId: 'audit-log-002',
  };

  it('validates a schema-compliant AITrainingGrant', () => {
    const parsed = AITrainingGrantSchema.parse(validGrantArtist1);
    expect(parsed.grantId).toBe('grant-001');
    expect(parsed.affirmativeOptIn).toBe(true);
  });

  it('denies export by default when no grants exist', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('Denied by default');
    expect(evaluation.unconsentedRightsholders).toEqual(['artist-alice']);
  });

  it('denies export when asset has unverified/empty rightsholders', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: [],
      grants: [validGrantArtist1],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('unverified or empty rightsholders');
  });

  it('denies export when not all required co-rightsholders have opted in', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice', 'artist-bob'],
      grants: [validGrantArtist1], // Only Alice opted in, Bob is missing
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('required rightsholder(s) have not affirmatively opted in');
    expect(evaluation.unconsentedRightsholders).toEqual(['artist-bob']);
  });

  it('denies export if any rightsholder revoked their consent', () => {
    const revokedGrant: AITrainingGrant = {
      ...validGrantArtist1,
      revokedAt: now - 1000,
    };

    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [revokedGrant],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('was revoked');
  });

  it('denies export if consent grant has expired', () => {
    const expiredGrant: AITrainingGrant = {
      ...validGrantArtist1,
      expiresAt: now - 1000, // Expired in the past
    };

    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [expiredGrant],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('has expired');
  });

  it('denies export if requested vendor differs from authorized vendor', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [validGrantArtist1],
      requestedVendor: 'UnauthorizedScraperAI',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('authorizes vendor "TrustedModelPartner", but "UnauthorizedScraperAI" was requested');
  });

  it('denies export if requested scope differs from authorized scopes', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [validGrantArtist1],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'voice_timbre_model', // Alice only authorized stem separation & music foundation
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('does not authorize scope "voice_timbre_model"');
  });

  it('denies export if contractual compensation is not settled/paid', () => {
    const unpaidGrant: AITrainingGrant = {
      ...validGrantArtist1,
      compensation: {
        ...validGrantArtist1.compensation,
        paidAt: null,
        payoutTransactionId: null,
      },
    };

    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants: [unpaidGrant],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('is not settled/paid');
  });

  it('authorizes export when all rightsholders have valid, active, settled grants for the requested scope and vendor', () => {
    const evaluation = evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice', 'artist-bob'],
      grants: [validGrantArtist1, validGrantArtist2],
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
    });

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.reason).toBeUndefined();
    expect(evaluation.unconsentedRightsholders).toBeUndefined();
  });

  // Pure policy regressions; these literals do not prove signed consent,
  // actual payment settlement, or a deployed export service.
  function evaluate(grants: AITrainingGrant[] = [validGrantArtist1], overrides: Record<string, unknown> = {}) {
    return evaluateAITrainingExport({
      assetId: 'rec-123',
      assetType: 'master_recording',
      requiredRightsholderEntityIds: ['artist-alice'],
      grants,
      requestedVendor: 'TrustedModelPartner',
      requestedScope: 'stem_separation_model',
      currentTime: now,
      ...overrides,
    } as Parameters<typeof evaluateAITrainingExport>[0]);
  }

  it('does not reuse recording consent for artwork sharing the same asset ID', () => {
    expect(evaluate(undefined, { assetType: 'artwork' }).allowed).toBe(false);
  });

  it('selects a matching asset type rather than an unrelated earlier grant', () => {
    const artworkGrant: AITrainingGrant = { ...validGrantArtist1, assetType: 'artwork', authorizedVendor: 'OtherVendor' };
    expect(evaluate([artworkGrant, validGrantArtist1]).allowed).toBe(true);
  });

  it('rejects consent that has not yet been given', () => {
    expect(evaluate([{ ...validGrantArtist1, optInTimestamp: now + 1 }]).allowed).toBe(false);
  });

  it('rejects compensation with a future settlement time', () => {
    expect(evaluate([{ ...validGrantArtist1, compensation: { ...validGrantArtist1.compensation, paidAt: now + 1 } }]).allowed).toBe(false);
  });

  it('does not treat a future-dated revocation record as active consent', () => {
    expect(evaluate([{ ...validGrantArtist1, revokedAt: now + 1 }]).allowed).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('fails closed for invalid evaluation time %s', currentTime => {
    const result = evaluate(undefined, { currentTime });
    expect(result.allowed).toBe(false);
    expect(Number.isFinite(result.evaluationTimestamp)).toBe(true);
  });

  it.each([
    { expiresAt: NaN },
    { expiresAt: Number.MAX_SAFE_INTEGER + 1 },
    { optInTimestamp: undefined },
    { auditLogId: '' },
    { compensation: { ...validGrantArtist1.compensation, paidAt: Infinity } },
    { compensation: { ...validGrantArtist1.compensation, termsAgreementHash: '' } },
    { compensation: { ...validGrantArtist1.compensation, payoutTransactionId: '   ' } },
    { compensation: { ...validGrantArtist1.compensation, artistCents: NaN } },
  ])('rejects malformed grant evidence at runtime (%j)', fields => {
    const grant = { ...validGrantArtist1, ...fields } as AITrainingGrant;
    expect(evaluate([grant]).allowed).toBe(false);
  });

  it.each([
    { assetId: '' },
    { requiredRightsholderEntityIds: [''] },
    { requestedVendor: '   ' },
    { requestedScope: 'unknown' },
    { grants: null },
  ])('rejects malformed export requests without throwing (%j)', fields => {
    expect(evaluate(undefined, fields).allowed).toBe(false);
  });

  it('accepts evidence effective exactly at the evaluation boundary', () => {
    expect(evaluate([{ ...validGrantArtist1, optInTimestamp: now, compensation: { ...validGrantArtist1.compensation, paidAt: now } }]).allowed).toBe(true);
  });

});
