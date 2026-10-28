import { describe, expect, it } from 'vitest';
import {
  matchRecordingToWork,
  RecordingToWorkMatchInputSchema,
  type RecordingToWorkMatchInput,
} from './recordingWorkMatching.js';

describe('Recording-to-Work Rights Matching and Unmatched Income Exceptions (CI-V3-20261021-03)', () => {
  const sampleAgreementHash = 'b'.repeat(64);

  const baseMatchInput: RecordingToWorkMatchInput = {
    matchId: 'match-rec-001',
    isrc: 'US-S1Z-26-00001',
    iswc: 'T-034.524.680-1',
    trackTitle: 'Midnight Drive',
    artistName: 'Indii Artist',
    writers: [
      {
        entityId: 'writer-alice',
        legalName: 'Alice Composer',
        proAffiliation: 'BMI',
        ipiNumber: '123456789',
        sharePercent: 50,
        role: 'composer',
      },
      {
        entityId: 'writer-bob',
        legalName: 'Bob Author',
        proAffiliation: 'ASCAP',
        ipiNumber: '987654321',
        sharePercent: 50,
        role: 'author',
      },
    ],
    publisher: null,
    societyAckToken: null,
    unclaimedIncomeCents: 0,
    sourceAgreementHash: sampleAgreementHash,
  };

  it('validates a schema-compliant match input', () => {
    const parsed = RecordingToWorkMatchInputSchema.parse(baseMatchInput);
    expect(parsed.matchId).toBe('match-rec-001');
    expect(parsed.isrc).toBe('US-S1Z-26-00001');
  });

  it('detects split disputes when total writer and publisher shares do not equal 100%', () => {
    const splitDisputeInput: RecordingToWorkMatchInput = {
      ...baseMatchInput,
      writers: [
        {
          ...baseMatchInput.writers[0],
          sharePercent: 60, // 60 + 50 = 110%
        },
        baseMatchInput.writers[1],
      ],
    };

    const result = matchRecordingToWork(splitDisputeInput);
    expect(result.status).toBe('conflict_detected');
    expect(result.splitsValid).toBe(false);
    expect(result.totalSplitShare).toBe(110);
    expect(result.exceptionCategory).toBe('split_dispute');
    expect(result.reconciliationSummary).toContain('Split conflict: Combined writer and publisher shares sum to 110%');
  });

  it('routes to missing_iswc exception when ISWC is null with zero accrued royalties', () => {
    const missingIswcInput: RecordingToWorkMatchInput = {
      ...baseMatchInput,
      iswc: null,
      unclaimedIncomeCents: 0,
    };

    const result = matchRecordingToWork(missingIswcInput);
    expect(result.status).toBe('unmatched_exception');
    expect(result.splitsValid).toBe(true);
    expect(result.exceptionCategory).toBe('missing_iswc');
    expect(result.reconciliationSummary).toContain('Pending ISWC: Master recording ISRC has no linked composition ISWC');
  });

  it('quarantines unmatched royalties into unclaimed_black_box_pool when ISWC is missing but royalties accrued', () => {
    const blackBoxInput: RecordingToWorkMatchInput = {
      ...baseMatchInput,
      iswc: null,
      unclaimedIncomeCents: 15420, // $154.20
    };

    const result = matchRecordingToWork(blackBoxInput);
    expect(result.status).toBe('unmatched_exception');
    expect(result.exceptionCategory).toBe('unclaimed_black_box_pool');
    expect(result.reconciliationSummary).toContain('Unmatched Income Pool: $154.20 in accrued royalties pending ISWC resolution');
  });

  it('creates a local draft match when splits are valid and ISWC is present but external ack token is absent', () => {
    const localDraftResult = matchRecordingToWork(baseMatchInput);
    expect(localDraftResult.status).toBe('draft_local');
    expect(localDraftResult.splitsValid).toBe(true);
    expect(localDraftResult.exceptionCategory).toBe('matched_pending_acknowledgement');
    expect(localDraftResult.reconciliationSummary).toContain('pending society acknowledgement receipt');
  });

  it('confirms society match only when verified society acknowledgement token is present', () => {
    const confirmedInput: RecordingToWorkMatchInput = {
      ...baseMatchInput,
      societyAckToken: 'MLC-ACK-2026-987654',
    };

    const result = matchRecordingToWork(confirmedInput);
    expect(result.status).toBe('confirmed_society_receipt');
    expect(result.splitsValid).toBe(true);
    expect(result.reconciliationSummary).toContain('Linked ISRC US-S1Z-26-00001 to ISWC T-034.524.680-1 with verified society token MLC-ACK-2026-987654');
    expect(result.provenanceHash).toBe(sampleAgreementHash);
  });
});
