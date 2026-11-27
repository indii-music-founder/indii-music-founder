import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    rememberBoardroomLease,
    forgetBoardroomLease,
    endBoardroomLeaseRun,
    releaseOrphanedBoardroomLease,
    resetBoardroomLeaseMemoryForTests,
} from '@/services/agent/boardroomLeaseRecovery';

const LEASE = '55555555-5555-4555-8555-555555555555';

describe('Boardroom dispatch lease recovery (ISSUE-1657)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        resetBoardroomLeaseMemoryForTests();
    });

    it('releases a lease orphaned by a reload of this tab', async () => {
        rememberBoardroomLease(LEASE);
        resetBoardroomLeaseMemoryForTests(); // simulate a page reload: memory gone, sessionStorage kept
        const complete = vi.fn().mockResolvedValue(undefined);

        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(true);
        expect(complete).toHaveBeenCalledWith(LEASE);
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(false);
        expect(complete).toHaveBeenCalledTimes(1);
    });

    it('never releases a lease whose run is still live in this page', async () => {
        rememberBoardroomLease(LEASE);
        const complete = vi.fn().mockResolvedValue(undefined);
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(false);
        expect(complete).not.toHaveBeenCalled();
    });

    it('keeps the id for a retry when release fails', async () => {
        rememberBoardroomLease(LEASE);
        resetBoardroomLeaseMemoryForTests();
        const complete = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(false);
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(true);
    });

    it('forgets a lease after normal completion', async () => {
        rememberBoardroomLease(LEASE);
        forgetBoardroomLease(LEASE);
        resetBoardroomLeaseMemoryForTests();
        const complete = vi.fn();
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(false);
        expect(complete).not.toHaveBeenCalled();
    });
    it('retries a failed release on the next turn in the same page', async () => {
        rememberBoardroomLease(LEASE);
        endBoardroomLeaseRun(LEASE); // the run ended but its release call failed
        const complete = vi.fn().mockResolvedValue(undefined);
        await expect(releaseOrphanedBoardroomLease(complete)).resolves.toBe(true);
        expect(complete).toHaveBeenCalledWith(LEASE);
    });
});
