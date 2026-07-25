import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { finalizeOperationReservation } from '../billing/enforceOperationCost';

type TerminalVideoSessionStatus = 'completed' | 'failed' | 'cancelled';
type ReservationOutcome = 'SETTLED' | 'VOIDED';

export interface VideoSessionCostFinalizer {
    (params: {
        userId: string;
        operationId: string;
        outcome: ReservationOutcome;
    }): Promise<void>;
}

function terminalOutcome(status: unknown): ReservationOutcome | undefined {
    if (status === 'completed') return 'SETTLED';
    if (status === 'failed' || status === 'cancelled') return 'VOIDED';
    return undefined;
}

/**
 * Reconciles a durable session terminal state with the shared cost ledger.
 * `finalizeOperationReservation` is transactional and idempotent, so duplicate
 * Firestore delivery can neither double-charge nor double-refund.
 */
export async function reconcileVideoSessionCost(
    sessionId: string,
    rawSession: unknown,
    finalize: VideoSessionCostFinalizer = finalizeOperationReservation,
): Promise<{ finalized: false } | {
    finalized: true;
    status: TerminalVideoSessionStatus;
    outcome: ReservationOutcome;
}> {
    if (!rawSession || typeof rawSession !== 'object' || Array.isArray(rawSession)) {
        return { finalized: false };
    }
    const session = rawSession as Record<string, unknown>;
    const outcome = terminalOutcome(session.status);
    if (!outcome) return { finalized: false };

    const ownerUid = typeof session.ownerUid === 'string' ? session.ownerUid.trim() : '';
    const costReservationId = typeof session.costReservationId === 'string'
        ? session.costReservationId.trim()
        : '';
    // Sessions created before cost reservations were introduced have nothing
    // to settle. Treating those legacy terminal writes as errors would make
    // this retrying trigger poison-loop whenever retention updates one.
    if (!costReservationId) return { finalized: false };
    if (!ownerUid || costReservationId !== `video-session-${sessionId}`) {
        throw new Error(`Video session ${sessionId} has an invalid cost reservation identity`);
    }

    await finalize({
        userId: ownerUid,
        operationId: costReservationId,
        outcome,
    });
    return {
        finalized: true,
        status: session.status as TerminalVideoSessionStatus,
        outcome,
    };
}

export const settleVideoSessionCost = onDocumentWritten(
    {
        document: 'videoSessions/{sessionId}',
        region: 'us-central1',
        retry: true,
    },
    async (event) => {
        const sessionId = event.params.sessionId;
        const after = event.data?.after;
        await reconcileVideoSessionCost(
            sessionId,
            after?.exists ? after.data() : undefined,
        );
    },
);
