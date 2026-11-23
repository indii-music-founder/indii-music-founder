import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.hoisted(() => vi.fn());
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => call) }));
vi.mock('@/services/firebase', () => ({ functions: {}, auth: { currentUser: { uid: 'owner-1' } } }));

import { loadCapabilitySnapshot, resetCapabilitySnapshotCache } from './CapabilitySnapshotService';

function freshSnapshot(ttlMs = 60_000) {
    const now = Date.now();
    const entry = { status: 'available' as const, observedAt: now - 1, expiresAt: now + ttlMs };
    return {
        schemaVersion: 'capability-snapshot.v1',
        observedAt: now - 1,
        expiresAt: now + ttlMs,
        capabilities: {
            specialist_routing: { ...entry }, image_generation: { ...entry }, video_generation: { ...entry },
            durable_workspace: { ...entry }, durable_memory: { ...entry }, calendar_connection: { ...entry },
            calendar_actions: { ...entry, approvalRequired: true }, social_connection: { ...entry },
            social_publishing: { ...entry, approvalRequired: true },
        },
    };
}

describe('loadCapabilitySnapshot cache (ISSUE-1658)', () => {
    beforeEach(() => {
        resetCapabilitySnapshotCache();
        call.mockReset();
    });

    it('shares one request between parallel seats and reuses it while fresh', async () => {
        call.mockResolvedValue({ data: freshSnapshot() });
        const seats = await Promise.all([loadCapabilitySnapshot(), loadCapabilitySnapshot(), loadCapabilitySnapshot()]);
        await loadCapabilitySnapshot();
        expect(call).toHaveBeenCalledTimes(1);
        expect(seats.every(snapshot => snapshot.capabilities.image_generation.status === 'available')).toBe(true);
    });

    it('fetches again once the server snapshot expires', async () => {
        vi.useFakeTimers();
        try {
            call.mockResolvedValue({ data: freshSnapshot(1_000) });
            await loadCapabilitySnapshot();
            await vi.advanceTimersByTimeAsync(1_500);
            call.mockResolvedValue({ data: freshSnapshot() });
            await loadCapabilitySnapshot();
            expect(call).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not cache a failure', async () => {
        call.mockRejectedValueOnce(new Error('network'));
        const failed = await loadCapabilitySnapshot();
        expect(failed.capabilities.image_generation.status).toBe('unverified');
        call.mockResolvedValueOnce({ data: freshSnapshot() });
        const next = await loadCapabilitySnapshot();
        expect(next.capabilities.image_generation.status).toBe('available');
        expect(call).toHaveBeenCalledTimes(2);
    });
});
