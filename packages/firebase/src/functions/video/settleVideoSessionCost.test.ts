import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentWritten: vi.fn((_options, handler) => handler),
}));

vi.mock('../billing/enforceOperationCost', () => ({
    finalizeOperationReservation: vi.fn(),
}));

import { reconcileVideoSessionCost } from './settleVideoSessionCost';

describe('reconcileVideoSessionCost', () => {
    it.each([
        ['completed', 'SETTLED'],
        ['failed', 'VOIDED'],
        ['cancelled', 'VOIDED'],
    ] as const)('maps terminal %s to one idempotent ledger %s request', async (status, outcome) => {
        const finalize = vi.fn().mockResolvedValue(undefined);
        const result = await reconcileVideoSessionCost('session-1', {
            ownerUid: 'artist-1',
            costReservationId: 'video-session-session-1',
            status,
        }, finalize);

        expect(result).toEqual({ finalized: true, status, outcome });
        expect(finalize).toHaveBeenCalledWith({
            userId: 'artist-1',
            operationId: 'video-session-session-1',
            outcome,
        });
    });

    it('ignores active states and rejects a terminal reservation not bound to the session', async () => {
        const finalize = vi.fn();
        await expect(reconcileVideoSessionCost('session-1', {
            ownerUid: 'artist-1',
            costReservationId: 'video-session-session-1',
            status: 'processing',
        }, finalize)).resolves.toEqual({ finalized: false });
        expect(finalize).not.toHaveBeenCalled();

        await expect(reconcileVideoSessionCost('session-1', {
            ownerUid: 'artist-1',
            costReservationId: 'video-session-foreign-session',
            status: 'completed',
        }, finalize)).rejects.toThrow('invalid cost reservation identity');
    });

    it('ignores legacy terminal sessions that predate cost reservations', async () => {
        const finalize = vi.fn();
        await expect(reconcileVideoSessionCost('session-1', {
            ownerUid: 'artist-1',
            status: 'completed',
        }, finalize)).resolves.toEqual({ finalized: false });
        expect(finalize).not.toHaveBeenCalled();
    });
});
