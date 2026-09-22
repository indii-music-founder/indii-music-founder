import { describe, expect, it } from 'vitest';
import { evaluateRightsIntelligence, type RightsIntelligenceInput, type RightsInterest } from './rightsIntelligence.js';

const now = '2026-09-22T13:00:00.000Z';
const provenance = { state: 'USER_DECLARED' as const, sourceType: 'USER' as const, sourceId: 'user-1', evidence: [], observedAt: now };
const interest = (overrides: Partial<RightsInterest> = {}): RightsInterest => ({
  interestId: 'interest-1', targetEntityId: 'recording:1', partyEntityId: 'person:1',
  interestType: 'MASTER_OWNER', sharePercentage: 100, territoryCodes: ['Worldwide'],
  state: 'DECLARED', provenance, ...overrides,
});
const input = (overrides: Partial<RightsIntelligenceInput> = {}): RightsIntelligenceInput => ({
  targetEntityId: 'recording:1', interests: [interest(), interest({ interestId: 'writer-1', interestType: 'WRITER' })],
  thirdPartyUses: [], grants: [], evidenceVaults: [], ...overrides,
});

describe('rights intelligence', () => {
  it('does not treat declared ownership as automatic Content ID authority', () => {
    expect(evaluateRightsIntelligence(input(), now).contentIdAutomaticSubmissionEligible).toBe(false);
  });

  it('allows eligibility only for complete documented interests without third-party use', () => {
    const report = evaluateRightsIntelligence(input({
      interests: [
        interest({ state: 'DOCUMENTED' }),
        interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED' }),
      ],
      evidenceVaults: [{ entityId: 'recording:1', evidence: [{ id: 'split-sheet-1', type: 'AGREEMENT', contentSha256: 'a'.repeat(64) }] }],
    }), now);
    expect(report.contentIdAutomaticSubmissionEligible).toBe(true);
    expect(report.releaseReviewRequired).toBe(false);
  });

  it('requires evidence for documented ownership', () => {
    const report = evaluateRightsIntelligence(input({ interests: [
      interest({ state: 'DOCUMENTED' }),
      interest({ interestId: 'writer-1', interestType: 'WRITER', state: 'VERIFIED' }),
    ] }), now);
    expect(report.findings.some((finding) => finding.code === 'EVIDENCE_MISSING')).toBe(true);
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
});
