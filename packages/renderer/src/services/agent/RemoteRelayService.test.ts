import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';

const mocks = vi.hoisted(() => ({
    isFirebaseE2EMockEnabled: vi.fn(() => false),
    currentUser: null as { uid: string } | null,
    addDoc: vi.fn(),
    runTransaction: vi.fn(),
}));

vi.mock('@/utils/e2eMode', () => ({
    isFirebaseE2EMockEnabled: mocks.isFirebaseE2EMockEnabled,
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    get auth() {
        return { get currentUser() { return mocks.currentUser; } };
    },
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(() => ({ __collection: true })),
        doc: vi.fn(() => ({ __doc: true })),
        addDoc: mocks.addDoc,
        runTransaction: mocks.runTransaction,
        serverTimestamp: vi.fn(() => 'server-timestamp'),
    };
});

import {
    cacheRemotePairingToken,
    getCachedRemotePairingToken,
    isFreshDesktopState,
    isPrivateIP,
    relayTimestampToMillis,
    remoteRelayService,
    DESKTOP_HEARTBEAT_STALE_MS as _DESKTOP_HEARTBEAT_STALE_MS,
    type DesktopState
} from './RemoteRelayService';

describe('RemoteRelayService - dispatchTask (ISSUE-982)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isFirebaseE2EMockEnabled.mockReturnValue(false);
        mocks.currentUser = null;
    });

    it('throws instead of returning null when no user is authenticated', async () => {
        mocks.currentUser = null;

        await expect(
            remoteRelayService.dispatchTask({ type: 'live_moment', payload: { noteText: 'hello' } })
        ).rejects.toThrow('Not authenticated');

        expect(mocks.addDoc).not.toHaveBeenCalled();
    });

    it('returns a real durable task ID when authenticated', async () => {
        mocks.currentUser = { uid: 'user-1' };
        mocks.addDoc.mockResolvedValue({ id: 'doc-123' });

        const id = await remoteRelayService.dispatchTask({ type: 'live_moment', payload: { noteText: 'hello' } });

        expect(id).toBe('doc-123');
        expect(mocks.addDoc).toHaveBeenCalledTimes(1);
    });

    it('returns a synthetic non-null ID in E2E mock mode without touching Firestore', async () => {
        mocks.isFirebaseE2EMockEnabled.mockReturnValue(true);
        mocks.currentUser = null;

        const id = await remoteRelayService.dispatchTask({ type: 'live_moment', payload: { noteText: 'hello' } });

        expect(id).toBeTruthy();
        expect(mocks.addDoc).not.toHaveBeenCalled();
    });
});

describe('RemoteRelayService - claimDispatchTask (ISSUE-984)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isFirebaseE2EMockEnabled.mockReturnValue(false);
        mocks.currentUser = { uid: 'user-1' };
    });

    it('wins the claim and flips pending → processing when the task is still pending', async () => {
        const txUpdate = vi.fn();
        mocks.runTransaction.mockImplementation(async (_db, updateFn) => {
            const tx = {
                get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ status: 'pending' }) }),
                update: txUpdate,
            };
            return updateFn(tx);
        });

        const claimed = await remoteRelayService.claimDispatchTask('task-1');

        expect(claimed).toBe(true);
        expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'processing' }));
    });

    it('loses the claim without writing when another listener already claimed it', async () => {
        const txUpdate = vi.fn();
        mocks.runTransaction.mockImplementation(async (_db, updateFn) => {
            const tx = {
                get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ status: 'processing' }) }),
                update: txUpdate,
            };
            return updateFn(tx);
        });

        const claimed = await remoteRelayService.claimDispatchTask('task-1');

        expect(claimed).toBe(false);
        expect(txUpdate).not.toHaveBeenCalled();
    });

    it('loses the claim when the task no longer exists', async () => {
        mocks.runTransaction.mockImplementation(async (_db, updateFn) => {
            const tx = { get: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined }), update: vi.fn() };
            return updateFn(tx);
        });

        expect(await remoteRelayService.claimDispatchTask('task-1')).toBe(false);
    });

    it('returns false (not throw) when the transaction itself fails', async () => {
        mocks.runTransaction.mockRejectedValue(new Error('Firestore unavailable'));

        await expect(remoteRelayService.claimDispatchTask('task-1')).resolves.toBe(false);
    });

    it('returns false without touching Firestore when no user is authenticated', async () => {
        mocks.currentUser = null;

        expect(await remoteRelayService.claimDispatchTask('task-1')).toBe(false);
        expect(mocks.runTransaction).not.toHaveBeenCalled();
    });
});

describe('RemoteRelayService - local pairing token cache', () => {
    it('caches a URL passcode for reconnect auth', () => {
        localStorage.clear();

        expect(getCachedRemotePairingToken('?passcode=abc123')).toBe('abc123');
        expect(localStorage.getItem('indii_p2p_passcode')).toBe('abc123');
    });

    it('falls back to the cached passcode when the URL no longer has one', () => {
        localStorage.clear();
        cacheRemotePairingToken('stored-token');

        expect(getCachedRemotePairingToken('')).toBe('stored-token');
    });

    it('ignores empty passcodes', () => {
        localStorage.clear();

        expect(cacheRemotePairingToken('   ')).toBeNull();
        expect(localStorage.getItem('indii_p2p_passcode')).toBeNull();
    });
});

describe('RemoteRelayService - relayTimestampToMillis', () => {
    it('handles numeric timestamps', () => {
        expect(relayTimestampToMillis(123456789)).toBe(123456789);
    });

    it('handles Firestore Timestamp objects', () => {
        const ts = Timestamp.fromMillis(987654321);
        expect(relayTimestampToMillis(ts)).toBe(987654321);
    });

    it('handles mock/undefined timestamps gracefully', () => {
        expect(relayTimestampToMillis(undefined)).toBe(0);
    });
});

describe('RemoteRelayService - isPrivateIP', () => {
    it('identifies localhost and 127.0.0.1 as private', () => {
        expect(isPrivateIP('localhost')).toBe(true);
        expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('identifies Class A private IP space', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
        expect(isPrivateIP('10.255.255.255')).toBe(true);
        expect(isPrivateIP('10.1.2.3')).toBe(true);
    });

    it('identifies Class C private IP space', () => {
        expect(isPrivateIP('192.168.1.1')).toBe(true);
        expect(isPrivateIP('192.168.100.254')).toBe(true);
    });

    it('identifies Class B private IP space within correct boundaries', () => {
        expect(isPrivateIP('172.16.0.1')).toBe(true);
        expect(isPrivateIP('172.31.255.255')).toBe(true);
        expect(isPrivateIP('172.15.255.255')).toBe(false); // Below range
        expect(isPrivateIP('172.32.0.1')).toBe(false); // Above range
    });

    it('handles public IP addresses', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false);
        expect(isPrivateIP('1.1.1.1')).toBe(false);
        expect(isPrivateIP('google.com')).toBe(false);
    });

    it('fails on IPv6 loopback / local hosts (Boundary check)', () => {
        // Since isPrivateIP only checks IPv4 prefixes, IPv6 loops will fail
        expect(isPrivateIP('::1')).toBe(false);
        expect(isPrivateIP('[::1]')).toBe(false);
        expect(isPrivateIP('fe80::1')).toBe(false);
    });
});

describe('RemoteRelayService - isFreshDesktopState', () => {
    const createMockState = (millis: number, online = true): DesktopState => ({
        currentModule: 'dashboard',
        isAgentProcessing: false,
        activeSessionId: 'session-123',
        online,
        timestamp: Timestamp.fromMillis(millis)
    });

    it('returns false for offline state regardless of timestamp recency', () => {
        const now = Date.now();
        const state = createMockState(now, false);
        expect(isFreshDesktopState(state, now)).toBe(false);
    });

    it('returns true for perfectly synchronized and recent state', () => {
        const now = Date.now();
        const state = createMockState(now - 10000, true); // 10s old
        expect(isFreshDesktopState(state, now)).toBe(true);
    });

    it('returns false for state older than heartbeat window + skew tolerance', () => {
        const now = Date.now();
        // staleMs = 120s, CLOCK_SKEW_TOLERANCE_MS = 30s. Total threshold = 150s.
        const state = createMockState(now - 151000, true); // 151s old
        expect(isFreshDesktopState(state, now)).toBe(false);
    });

    it('handles negative clock skew (phone clock is behind server clock)', () => {
        const now = Date.now();
        // Server clock is 20s ahead of phone (timestamp is now + 20s)
        const state = createMockState(now + 20000, true);
        expect(isFreshDesktopState(state, now)).toBe(true);
    });

    it('rejects state when clock skew exceeds 30s (phone clock is 40s behind server)', () => {
        const now = Date.now();
        // Server clock is 160s ahead of phone
        const state = createMockState(now + 160000, true);
        expect(isFreshDesktopState(state, now)).toBe(false);
    });

    it('rejects state when phone clock is ahead of server clock and difference is > 150s', () => {
        const now = Date.now();
        // Phone clock is 160s ahead of server (timestamp is now - 160s)
        const state = createMockState(now - 160000, true);
        expect(isFreshDesktopState(state, now)).toBe(false);
    });

    it('demonstrates vulnerability: healthy heartbeat is rejected due to clock skew', () => {
        const now = Date.now();
        // Desktop heartbeat was sent 5 seconds ago (very fresh on the server).
        // However, the phone's clock has a drift of 35 seconds relative to server.
        // So the phone calculates the timestamp difference as:
        // Phone clock is ahead of server by 146 seconds.
        // timestamp = now - 151000 (heartbeat 5s ago + 146s drift = 151s difference).
        // Math.abs(now - timestamp) = 151000.
        // Since 151000 > 150000 (120s stale threshold + 30s skew tolerance),
        // the phone considers the desktop offline, even though it was active 5s ago!
        const state = createMockState(now - 151000, true);
        expect(isFreshDesktopState(state, now)).toBe(false);
    });
});
