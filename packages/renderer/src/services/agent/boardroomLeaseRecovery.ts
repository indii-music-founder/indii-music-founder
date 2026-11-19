import { logger } from '@/utils/logger';

/**
 * Per-tab memory of the Boardroom dispatch lease (ISSUE-1657).
 *
 * The server holds a 15-minute lease per turn. If the tab reloads mid-turn,
 * the fire-and-forget release never runs and every new discussion is refused
 * until the lease expires. sessionStorage survives a reload of the same tab
 * but is not shared with other tabs or devices, so only this tab's own
 * orphaned lease is ever released.
 */
const STORAGE_KEY = 'indii:boardroom:activeDispatchLease';

/** Leases owned by a run that is still executing in this page. */
const liveLeases = new Set<string>();

function storage(): Storage | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        return null;
    }
}

export function rememberBoardroomLease(leaseId: string): void {
    liveLeases.add(leaseId);
    try {
        storage()?.setItem(STORAGE_KEY, leaseId);
    } catch (error) {
        logger.warn('[BoardroomLease] Could not persist dispatch lease id:', error);
    }
}

/** The run that owned this lease ended; keep the stored id so a failed release is retried next turn. */
export function endBoardroomLeaseRun(leaseId: string): void {
    liveLeases.delete(leaseId);
}

export function forgetBoardroomLease(leaseId: string): void {
    liveLeases.delete(leaseId);
    try {
        const store = storage();
        if (store?.getItem(STORAGE_KEY) === leaseId) store.removeItem(STORAGE_KEY);
    } catch (error) {
        logger.warn('[BoardroomLease] Could not clear dispatch lease id:', error);
    }
}

/**
 * Release a lease left behind by an earlier page instance of this tab.
 * Returns true when an orphaned lease was released. A failed release keeps
 * the id so the next turn can retry; it never blocks the new turn.
 */
export async function releaseOrphanedBoardroomLease(
    complete: (leaseId: string) => Promise<void>,
): Promise<boolean> {
    let leaseId: string | null = null;
    try {
        leaseId = storage()?.getItem(STORAGE_KEY) ?? null;
    } catch {
        return false;
    }
    if (!leaseId || liveLeases.has(leaseId)) return false;
    try {
        await complete(leaseId);
        forgetBoardroomLease(leaseId);
        return true;
    } catch (error) {
        logger.warn('[BoardroomLease] Orphaned dispatch lease release failed; will retry next turn:', error);
        return false;
    }
}

/** Test-only reset of in-memory state. */
export function resetBoardroomLeaseMemoryForTests(): void {
    liveLeases.clear();
}
