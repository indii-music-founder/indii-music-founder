import { z } from 'zod';

export const CwrLifecycleStateSchema = z.enum([
  'prepared',
  'exported',
  'submitted',
  'acknowledged',
  'registered',
]);
export type CwrLifecycleState = z.infer<typeof CwrLifecycleStateSchema>;

export const CwrExportEvidenceSchema = z.object({
  filename: z.string().trim().min(1),
  fileChecksum: z.string().trim().length(64),
  byteLength: z.number().int().positive(),
  exportedAt: z.string().datetime(),
}).strict();
export type CwrExportEvidence = z.infer<typeof CwrExportEvidenceSchema>;

export const CwrSubmissionEvidenceSchema = z.object({
  transportManifestDigest: z.string().trim().min(16),
  receiverRoute: z.enum(['musicmark', 'the_mlc', 'sesac']),
  submittedAt: z.string().datetime(),
}).strict();
export type CwrSubmissionEvidence = z.infer<typeof CwrSubmissionEvidenceSchema>;

export const CwrAcknowledgmentEvidenceSchema = z.object({
  ackEvidenceHash: z.string().trim().length(64),
  parsedAckCount: z.number().int().positive(),
  receiverSenderCode: z.string().trim().min(1),
  acknowledgedAt: z.string().datetime(),
}).strict();
export type CwrAcknowledgmentEvidence = z.infer<typeof CwrAcknowledgmentEvidenceSchema>;

export const CwrRegistrationEvidenceSchema = z.object({
  societyWorkId: z.string().trim().min(1),
  societyName: z.string().trim().min(1),
  registrationToken: z.string().trim().min(16),
  registeredAt: z.string().datetime(),
}).strict();
export type CwrRegistrationEvidence = z.infer<typeof CwrRegistrationEvidenceSchema>;

export interface CwrTransitionEvidence {
  exportEvidence?: CwrExportEvidence;
  submissionEvidence?: CwrSubmissionEvidence;
  ackEvidence?: CwrAcknowledgmentEvidence;
  registrationEvidence?: CwrRegistrationEvidence;
}

/** Approval is reversible only before transport has been claimed. Never re-arm a sent file. */
export function canApproveCwrExport(state: unknown): boolean {
  return state === 'exported' || state === 'approved_export';
}

const LIFECYCLE_ORDER: Record<CwrLifecycleState, number> = {
  prepared: 0,
  exported: 1,
  submitted: 2,
  acknowledged: 3,
  registered: 4,
};

/**
 * Validates and advances CWR batch lifecycle through explicit distinct states:
 * prepared -> exported -> submitted -> acknowledged -> registered
 *
 * Strict policy:
 * - Direct jumps to 'registered' are strictly forbidden.
 * - Claiming 'registered' requires a verified societyWorkId and registrationToken.
 */
export function transitionCwrLifecycleState(
  currentState: CwrLifecycleState,
  targetState: CwrLifecycleState,
  evidence: CwrTransitionEvidence
): CwrLifecycleState {
  if (currentState === targetState) {
    return currentState;
  }

  const currentIndex = LIFECYCLE_ORDER[currentState];
  const targetIndex = LIFECYCLE_ORDER[targetState];

  if (targetIndex < currentIndex) {
    throw new Error(
      `Illegal backward lifecycle transition from ${currentState} to ${targetState}. CWR lifecycle states are monotonically forward.`
    );
  }

  if (targetIndex > currentIndex + 1) {
    throw new Error(
      `Illegal skipped lifecycle transition from ${currentState} to ${targetState}. CWR batches must follow the explicit sequential pipeline.`
    );
  }

  switch (targetState) {
    case 'exported': {
      if (!evidence.exportEvidence) {
        throw new Error('Transition to exported requires valid CwrExportEvidence with sha256 checksum and byteLength.');
      }
      CwrExportEvidenceSchema.parse(evidence.exportEvidence);
      break;
    }
    case 'submitted': {
      if (!evidence.submissionEvidence) {
        throw new Error('Transition to submitted requires valid CwrSubmissionEvidence with transportManifestDigest.');
      }
      CwrSubmissionEvidenceSchema.parse(evidence.submissionEvidence);
      break;
    }
    case 'acknowledged': {
      if (!evidence.ackEvidence) {
        throw new Error('Transition to acknowledged requires valid CwrAcknowledgmentEvidence with ackEvidenceHash.');
      }
      CwrAcknowledgmentEvidenceSchema.parse(evidence.ackEvidence);
      break;
    }
    case 'registered': {
      if (!evidence.registrationEvidence) {
        throw new Error('Transition to registered requires valid CwrRegistrationEvidence with confirmed societyWorkId.');
      }
      const reg = CwrRegistrationEvidenceSchema.parse(evidence.registrationEvidence);
      if (!reg.societyWorkId || reg.societyWorkId.trim().length === 0) {
        throw new Error('Cannot claim registration without confirmed society work identifier.');
      }
      break;
    }
    default:
      break;
  }

  return targetState;
}
