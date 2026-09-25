import {
    judgeSubmissionTriage,
    type SubmissionPayload,
    type TriageDecision,
} from '@/config/typesafeJudgments';

/**
 * Deterministic submission triage baseline:
 * Validates broadcast audio specs (sample rate >= 44.1kHz), metadata completeness,
 * and contact provenance.
 */
export function triageSubmissionDeterministic(payload: SubmissionPayload): TriageDecision {
    if (payload.metadataCompleteness < 0.25 || !payload.audioFormat) {
        return 'REJECT_SILENT';
    }

    const hasBroadcastAudio = payload.sampleRate >= 44100;
    const hasSufficientMetadata = payload.metadataCompleteness >= 0.75;

    if (hasBroadcastAudio && hasSufficientMetadata && payload.contactProvided) {
        return 'AUTO_APPROVE';
    }

    return 'FLAG_FOR_AUDIT';
}

/**
 * Triage incoming release submissions using fast Jev decision classification.
 * Falls back immediately to the deterministic audio spec validator.
 */
export async function triageReleaseSubmission(payload: SubmissionPayload): Promise<TriageDecision> {
    try {
        const decision = await judgeSubmissionTriage(payload);
        if (decision) {
            return decision;
        }
    } catch {
        // Fall through to deterministic triage
    }

    return triageSubmissionDeterministic(payload);
}
