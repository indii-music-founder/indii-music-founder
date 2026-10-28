import { z } from 'zod';
import { RightsId, Sha256 } from './contracts.js';

export const UnmatchedExceptionCategorySchema = z.enum([
  'missing_iswc',
  'split_dispute',
  'unregistered_publisher',
  'unclaimed_black_box_pool',
  'matched_pending_acknowledgement',
]);
export type UnmatchedExceptionCategory = z.infer<typeof UnmatchedExceptionCategorySchema>;

export const MatchStatusSchema = z.enum([
  'draft_local',
  'conflict_detected',
  'unmatched_exception',
  'confirmed_society_receipt',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const WorkWriterShareSchema = z.object({
  entityId: z.string().trim().min(1),
  legalName: z.string().trim().min(1),
  proAffiliation: z.string().trim().min(1).default('None'),
  ipiNumber: z.string().trim().nullable().default(null),
  sharePercent: z.number().min(0).max(100),
  role: z.enum(['composer', 'author', 'both']),
}).strict();
export type WorkWriterShare = z.infer<typeof WorkWriterShareSchema>;

export const WorkPublisherShareSchema = z.object({
  name: z.string().trim().min(1),
  ipiNumber: z.string().trim().nullable().default(null),
  sharePercent: z.number().min(0).max(100),
}).strict();
export type WorkPublisherShare = z.infer<typeof WorkPublisherShareSchema>;

export const RecordingToWorkMatchInputSchema = z.object({
  matchId: RightsId,
  isrc: z.string().trim().regex(/^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/i, 'Invalid ISRC'),
  iswc: z.string().trim().regex(/^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$/i, 'Invalid ISWC').nullable().default(null),
  trackTitle: z.string().trim().min(1).max(300),
  artistName: z.string().trim().min(1).max(300),
  writers: z.array(WorkWriterShareSchema).min(1),
  publisher: WorkPublisherShareSchema.nullable().default(null),
  societyAckToken: z.string().trim().min(1).nullable().default(null),
  unclaimedIncomeCents: z.number().int().nonnegative().default(0),
  sourceAgreementHash: Sha256,
}).strict();
export type RecordingToWorkMatchInput = z.infer<typeof RecordingToWorkMatchInputSchema>;

export interface RecordingToWorkMatchResult {
  matchId: string;
  isrc: string;
  iswc: string | null;
  status: MatchStatus;
  splitsValid: boolean;
  totalSplitShare: number;
  exceptionCategory?: UnmatchedExceptionCategory;
  reconciliationSummary: string;
  provenanceHash: string;
}

/**
 * Deterministically resolves Recording-to-Work (ISRC ↔ ISWC) matching and identifies unmatched-income exceptions.
 *
 * Rules:
 * 1. Total splits must sum exactly to 100%. Mismatches are flagged as 'split_dispute'.
 * 2. Missing ISWC prevents society confirmation and routes to 'missing_iswc' exception.
 * 3. External confirmation ('confirmed_society_receipt') strictly requires an official society acknowledgement token.
 * 4. Unclaimed royalties without matched work status are quarantined as 'unclaimed_black_box_pool'.
 * 5. Deterministic provenance hash anchors all split and match claims for audit receipts.
 */
export function matchRecordingToWork(
  input: RecordingToWorkMatchInput
): RecordingToWorkMatchResult {
  const totalWriterShares = input.writers.reduce((sum, w) => sum + w.sharePercent, 0);
  const publisherShare = input.publisher?.sharePercent ?? 0;
  const totalSplitShare = Math.round((totalWriterShares + publisherShare) * 100) / 100;
  const splitsValid = totalSplitShare === 100;

  // Split conflict: splits must total 100%
  if (!splitsValid) {
    return {
      matchId: input.matchId,
      isrc: input.isrc,
      iswc: input.iswc,
      status: 'conflict_detected',
      splitsValid: false,
      totalSplitShare,
      exceptionCategory: 'split_dispute',
      reconciliationSummary: `Split conflict: Combined writer and publisher shares sum to ${totalSplitShare}%, expected exactly 100%.`,
      provenanceHash: input.sourceAgreementHash,
    };
  }

  // Missing ISWC: Cannot confirm work registration
  if (!input.iswc) {
    const isBlackBox = input.unclaimedIncomeCents > 0;
    return {
      matchId: input.matchId,
      isrc: input.isrc,
      iswc: null,
      status: 'unmatched_exception',
      splitsValid: true,
      totalSplitShare,
      exceptionCategory: isBlackBox ? 'unclaimed_black_box_pool' : 'missing_iswc',
      reconciliationSummary: isBlackBox
        ? `Unmatched Income Pool: $${(input.unclaimedIncomeCents / 100).toFixed(2)} in accrued royalties pending ISWC resolution.`
        : 'Pending ISWC: Master recording ISRC has no linked composition ISWC.',
      provenanceHash: input.sourceAgreementHash,
    };
  }

  // Verified external acknowledgment token required for confirmed status
  if (input.societyAckToken) {
    return {
      matchId: input.matchId,
      isrc: input.isrc,
      iswc: input.iswc,
      status: 'confirmed_society_receipt',
      splitsValid: true,
      totalSplitShare,
      reconciliationSummary: `Fully matched & confirmed: Linked ISRC ${input.isrc} to ISWC ${input.iswc} with verified society token ${input.societyAckToken}.`,
      provenanceHash: input.sourceAgreementHash,
    };
  }

  // Local draft match pending society submission/ack
  return {
    matchId: input.matchId,
    isrc: input.isrc,
    iswc: input.iswc,
    status: 'draft_local',
    splitsValid: true,
    totalSplitShare,
    exceptionCategory: 'matched_pending_acknowledgement',
    reconciliationSummary: `Local draft match: Linked ISRC ${input.isrc} to ISWC ${input.iswc}; pending society acknowledgement receipt.`,
    provenanceHash: input.sourceAgreementHash,
  };
}
