import { describe, expect, it } from 'vitest';
import {
  evaluateRightsIntelligence,
  RightsGrantSchema,
  RightsIntelligenceReportSchema,
  type AIUseScope,
  type RightsGrant,
  type RightsIntelligenceInput,
  type RightsInterest,
} from './rightsIntelligence.js';

const now = '2026-09-22T13:00:00.000Z';
const provenance = { state: 'USER_DECLARED' as const, sourceType: 'USER' as const, sourceId: 'user-1', evidence: [], observedAt: now };
const documentedProvenance = { ...provenance, state: 'DOCUMENTED' as const, sourceType: 'DOCUMENT' as const };
const verifiedProvenance = { ...provenance, state: 'EXTERNAL_VERIFIED' as const, sourceType: 'EXTERNAL_SERVICE' as const };
const interest = (overrides: Partial<RightsInterest> = {}): RightsInterest => ({
  interestId: 'interest-1', targetEntityId: 'recording:1', partyEntityId: 'person:1',
  interestType: 'MASTER_OWNER', sharePercentage: 100, territoryCodes: ['Worldwide'],
  state: 'DECLARED', provenance, ...overrides,
});
const input = (overrides: Partial<RightsIntelligenceInput> = {}): RightsIntelligenceInput => ({
  targetEntityId: 'recording:1', interests: [interest(), interest({ interestId: 'writer-1', interestType: 'WRITER' })],
  thirdPartyUses: [], grants: [], evidenceVaults: [], ...overrides,
});
const aiUseScope: AIUseScope = {
  modality: 'GENERATIVE',
  purposes: ['TRAINING', 'FINE_TUNING'],
  materials: ['SOUND_RECORDING', 'LYRICS', 'VOICE'],
  modelScope: { type: 'NAMED_MODELS', modelIdentifiers: ['provider/model-v1'] },
  commercialUse: 'UNSPECIFIED',
  sublicensing: 'PROHIBITED',
};
const aiUseGrant = (overrides: Partial<RightsGrant> = {}): RightsGrant => ({
  grantId: 'ai-grant-1', subjectEntityId: 'recording:1', grantorEntityId: 'person:1', granteeEntityId: 'org:model-provider',
  rights: ['AI_USE'], aiUseScope, territoryCodes: ['US'], exclusive: false, state: 'DECLARED', provenance, evidence: [],
  ...overrides,
});

describe('rights intelligence', () => {
  it.each([
    'ISRC:USABC2600001',
    'USABC2600001',
    'T-123.456.789-0',
    'UPC:012345678905',
    '012345678905',
    'spotify:track:external-id',
    'grid:GRID-123',
    'catalog_number:legacy-7',
    'platform_id:spotify-123',
    'proprietary:label-123',
  ])('rejects external identifiers in canonical AI-use entity references: %s', externalId => {
    expect(() => RightsGrantSchema.parse(aiUseGrant({ subjectEntityId: externalId }))).toThrow(/internal IDs/);
    expect(() => RightsGrantSchema.parse(aiUseGrant({ grantorEntityId: externalId }))).toThrow(/internal IDs/);
    expect(() => RightsGrantSchema.parse(aiUseGrant({ granteeEntityId: externalId }))).toThrow(/internal IDs/);
    expect(() => RightsGrantSchema.parse(aiUseGrant({
      aiUseScope: { ...aiUseScope, modelScope: { type: 'PROVIDERS', providerOrganizationEntityIds: [externalId] } },
    }))).toThrow(/internal IDs/);
  });

  it('continues to accept internal canonical IDs that use entity-type namespaces', () => {
    expect(RightsGrantSchema.parse(aiUseGrant({
      subjectEntityId: 'recording:internal-1',
      grantorEntityId: 'person:internal-1',
      granteeEntityId: 'organization:internal-1',
      aiUseScope: {
        ...aiUseScope,
        modelScope: { type: 'PROVIDERS', providerOrganizationEntityIds: ['organization:provider-1'] },
      },
    })).granteeEntityId).toBe('organization:internal-1');
  });

  it('does not treat declared ownership as automatic Content ID authority', () => {
    expect(evaluateRightsIntelligence(input(), now).contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it('allows eligibility only for complete documented interests without third-party use', () => {
    const report = evaluateRightsIntelligence(input({
      interests: [
        interest({ state: 'DOCUMENTED', provenance: documentedProvenance }),
        interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED', provenance: verifiedProvenance }),
      ],
      evidenceVaults: [{ entityId: 'recording:1', evidence: [{ id: 'split-sheet-1', type: 'AGREEMENT', contentSha256: 'a'.repeat(64) }] }],
    }), now);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(true);
    expect(report.releaseReviewRequired).toBe(false);
  });

  it('requires evidence for documented ownership', () => {
    const report = evaluateRightsIntelligence(input({ interests: [
      interest({ state: 'DOCUMENTED', provenance: documentedProvenance }),
      interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED', provenance: verifiedProvenance }),
    ] }), now);
    expect(report.findings.some((finding) => finding.code === 'EVIDENCE_MISSING')).toBe(true);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it.each(['DECLARED', 'DETECTED', 'KNOWN', 'UNKNOWN', 'DISPUTED', 'UNRESOLVED'] as const)(
    'requires review when a 100%% core rights interest is %s', state => {
      const report = evaluateRightsIntelligence(input({
        interests: [
          interest({ state: 'DOCUMENTED' }),
          interest({ interestId: 'writer-1', interestType: 'WRITER', state, provenance: {
            ...provenance,
            state: state === 'DECLARED' ? 'USER_DECLARED'
              : state === 'DISPUTED' ? 'DISPUTED'
                : state === 'DETECTED' ? 'DETECTED' : 'UNKNOWN',
            sourceType: state === 'DETECTED' ? 'SYSTEM' : 'USER',
          } }),
        ],
        evidenceVaults: [{ entityId: 'recording:1', evidence: [{ id: 'agreement-1', type: 'AGREEMENT', contentSha256: 'a'.repeat(64) }] }],
      }), now);

      expect(report.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'RIGHTS_INTEREST_UNRESOLVED', severity: state === 'DISPUTED' || state === 'UNRESOLVED' ? 'BLOCKING' : 'REVIEW' }),
      ]));
      expect(report.releaseReviewRequired).toBe(true);
      expect(report.contentIdAutomaticSubmissionEligible).toBe(false);
    },
  );

  it('does not accept a documented label when provenance only records a user declaration', () => {
    const report = evaluateRightsIntelligence(input({ interests: [
      interest({ state: 'DOCUMENTED', provenance, }),
      interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED', provenance: verifiedProvenance }),
    ], evidenceVaults: [{ entityId: 'recording:1', evidence: [{ id: 'agreement-1', type: 'AGREEMENT' }] }] }), now);

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RIGHTS_INTEREST_UNRESOLVED', severity: 'REVIEW' }),
    ]));
    expect(report.releaseReviewRequired).toBe(true);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it('blocks invalid master split totals', () => {
    const report = evaluateRightsIntelligence(input({ interests: [
      interest({ sharePercentage: 60 }),
      interest({ interestId: 'owner-2', partyEntityId: 'person:2', sharePercentage: 60 }),
      interest({ interestId: 'writer-1', interestType: 'WRITER' }),
    ] }), now);
    expect(report.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MASTER_SPLITS_INVALID', severity: 'BLOCKING' })]));
  });

  it('keeps master and composition ownership distinct', () => {
    const report = evaluateRightsIntelligence(input({ interests: [interest()] }), now);
    expect(report.masterShareTotal).toBe(100);
    expect(report.compositionShareTotal).toBe(0);
    expect(report.publisherShareTotal).toBe(0);
    expect(report.findings.some((finding) => finding.code === 'COMPOSITION_OWNERSHIP_UNKNOWN')).toBe(true);
  });

  it('requires review for a detected sample with no evidence', () => {
    const report = evaluateRightsIntelligence(input({ thirdPartyUses: [{
      useId: 'sample-1', targetRecordingEntityId: 'recording:1', useType: 'SAMPLE',
      description: 'Possible drum break', state: 'DETECTED', exclusiveRightsConfirmed: false,
      provenance: { ...provenance, state: 'DETECTED', sourceType: 'SYSTEM' }, evidence: [],
    }] }), now);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'THIRD_PARTY_USE_UNRESOLVED', 'EXCLUSIVE_RIGHTS_UNCONFIRMED', 'EVIDENCE_MISSING',
    ]));
    expect(report.contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it('requires review for an unresolved territorial grant', () => {
    const report = evaluateRightsIntelligence(input({ grants: [{
      grantId: 'grant-1', subjectEntityId: 'recording:1', grantorEntityId: 'person:1', granteeEntityId: 'org:1',
      rights: ['SYNC'], territoryCodes: ['US'], exclusive: false, state: 'UNRESOLVED', provenance, evidence: [],
    }] }), now);
    expect(report.findings.some((finding) => finding.code === 'GRANT_UNRESOLVED')).toBe(true);
  });

  it('preserves legacy rights reports and grants without AI-use fields', () => {
    const report = RightsIntelligenceReportSchema.parse({
      schemaVersion: 'rights-intelligence.v1', targetEntityId: 'recording:1',
      masterShareTotal: 0, compositionShareTotal: 0, publisherShareTotal: 0,
      findings: [], releaseReviewRequired: false, contentIdAutomaticSubmissionEligible: false, evaluatedAt: now,
    });
    expect(report.aiUseStatus).toBe('UNKNOWN');
    expect(report.aiUseReviews).toEqual([]);
    expect(report.aiUseExecutionAuthorized).toBe(false);
    expect(RightsGrantSchema.parse({
      grantId: 'sync-1', subjectEntityId: 'recording:1', grantorEntityId: 'person:1', granteeEntityId: 'org:1',
      rights: ['SYNC'], territoryCodes: ['US'], exclusive: false, state: 'DECLARED', provenance, evidence: [],
    }).aiUseScope).toBeUndefined();
  });

  it('requires explicit AI-use scope only for grants that assert AI_USE', () => {
    const base = {
      grantId: 'ai-grant-1', subjectEntityId: 'recording:1', grantorEntityId: 'person:1', granteeEntityId: 'org:1',
      territoryCodes: ['US'], exclusive: false, state: 'DECLARED' as const, provenance, evidence: [],
    };
    expect(() => RightsGrantSchema.parse({ ...base, rights: ['AI_USE'] })).toThrow(/explicit modality/);
    expect(() => RightsGrantSchema.parse({ ...base, rights: ['SYNC'], aiUseScope })).toThrow(/only valid/);
    expect(RightsGrantSchema.parse({ ...base, rights: ['AI_USE'], aiUseScope }).aiUseScope?.purposes)
      .toEqual(['TRAINING', 'FINE_TUNING']);
  });

  it('keeps absent AI-use permission UNKNOWN and never grants authority', () => {
    const report = evaluateRightsIntelligence(input(), now);
    expect(report.aiUseStatus).toBe('UNKNOWN');
    expect(report.aiUseReviews).toEqual([]);
    expect(report.aiUseExecutionAuthorized).toBe(false);
  });

  it('keeps declared AI-use grants review-required and separate from release readiness', () => {
    const report = evaluateRightsIntelligence(input({
      interests: [
        interest({ state: 'DOCUMENTED', provenance: documentedProvenance }),
        interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED', provenance: verifiedProvenance }),
      ],
      evidenceVaults: [{ entityId: 'recording:1', evidence: [{ id: 'split-sheet-1', type: 'AGREEMENT' }] }],
      grants: [aiUseGrant()],
    }), now);

    expect(report.aiUseStatus).toBe('REVIEW_REQUIRED');
    expect(report.aiUseReviews).toEqual([expect.objectContaining({
      status: 'REVIEW_REQUIRED', requiresHumanReview: true, executionAuthorized: false,
      scope: expect.objectContaining({ modality: 'GENERATIVE', purposes: ['TRAINING', 'FINE_TUNING'] }),
    })]);
    expect(report.aiUseExecutionAuthorized).toBe(false);
    expect(report.releaseReviewRequired).toBe(false);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(true);
  });

  it('still reviews non-AI rights on a grant that also lists AI_USE', () => {
    const report = evaluateRightsIntelligence(input({ grants: [aiUseGrant({ rights: ['AI_USE', 'SYNC'] })] }), now);
    expect(report.aiUseStatus).toBe('REVIEW_REQUIRED');
    expect(report.findings.some((finding) => finding.code === 'GRANT_UNRESOLVED')).toBe(true);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it.each([
    ['GENERATIVE', ['TRAINING', 'FINE_TUNING']],
    ['NON_GENERATIVE', ['TRAINING', 'EVALUATION', 'INFERENCE']],
  ] as const)('applies the same non-authorizing review quality to %s AI use', (modality, purposes) => {
    const grant = aiUseGrant({ aiUseScope: { ...aiUseScope, modality, purposes: [...purposes] } });
    const report = evaluateRightsIntelligence(input({ grants: [grant] }), now);
    expect(report.aiUseReviews[0]).toMatchObject({ status: 'REVIEW_REQUIRED', requiresHumanReview: true, executionAuthorized: false });
    expect(report.aiUseExecutionAuthorized).toBe(false);
  });

  it.each([
    { state: 'DETECTED' as const, provenance: { ...provenance, state: 'DETECTED' as const, sourceType: 'SYSTEM' as const } },
    { state: 'UNKNOWN' as const, provenance: { ...provenance, state: 'INFERRED' as const, sourceType: 'AGENT' as const } },
    { state: 'UNKNOWN' as const, provenance: { ...provenance, state: 'UNKNOWN' as const, sourceType: 'IMPORT' as const } },
  ])('does not promote detected, inferred, or imported AI-use facts to permission', (assertion) => {
    const report = evaluateRightsIntelligence(input({ grants: [aiUseGrant(assertion)] }), now);
    expect(report.aiUseStatus).toBe('REVIEW_REQUIRED');
    expect(report.aiUseReviews[0]).toMatchObject({
      status: 'REVIEW_REQUIRED', state: assertion.state, provenanceState: assertion.provenance.state,
      requiresHumanReview: true, executionAuthorized: false,
    });
  });

  it('marks documented AI-use evidence as requiring human review rather than clearance', () => {
    const documentedAIGrant = aiUseGrant({
      state: 'DOCUMENTED', provenance: documentedProvenance,
      evidence: [{ id: 'ai-agreement-1', type: 'AGREEMENT', contentSha256: 'b'.repeat(64) }],
    });
    const report = evaluateRightsIntelligence(input({ grants: [documentedAIGrant] }), now);

    expect(report.aiUseStatus).toBe('EVIDENCE_BACKED_REQUIRES_HUMAN_REVIEW');
    expect(report.aiUseReviews[0]).toMatchObject({ status: 'EVIDENCE_BACKED_REQUIRES_HUMAN_REVIEW', evidenceCount: 1 });
    expect(report.aiUseExecutionAuthorized).toBe(false);
  });

  it('keeps externally verified provenance distinct from the grant truth state', () => {
    const report = evaluateRightsIntelligence(input({ grants: [aiUseGrant({
      state: 'VERIFIED', provenance: verifiedProvenance,
      evidence: [{ id: 'provider-record-1', type: 'EXTERNAL_RECORD' }],
    })] }), now);

    expect(report.aiUseReviews[0]).toMatchObject({
      state: 'VERIFIED', provenanceState: 'EXTERNAL_VERIFIED',
      status: 'EVIDENCE_BACKED_REQUIRES_HUMAN_REVIEW', executionAuthorized: false,
    });
  });

  it('surfaces disputed and expired AI-use grants without changing canonical grant state', () => {
    const disputed = evaluateRightsIntelligence(input({ grants: [aiUseGrant({
      state: 'DISPUTED', provenance: { ...provenance, state: 'DISPUTED' },
    })] }), now);
    const expired = evaluateRightsIntelligence(input({ grants: [aiUseGrant({
      state: 'DOCUMENTED', provenance: documentedProvenance, validThrough: '2026-09-21',
    })] }), now);

    expect(disputed.aiUseStatus).toBe('DISPUTED');
    expect(disputed.aiUseReviews[0]?.state).toBe('DISPUTED');
    expect(expired.aiUseStatus).toBe('REVIEW_REQUIRED');
    expect(expired.aiUseReviews[0]?.status).toBe('EXPIRED');
    expect(expired.aiUseExecutionAuthorized).toBe(false);
  });
});
