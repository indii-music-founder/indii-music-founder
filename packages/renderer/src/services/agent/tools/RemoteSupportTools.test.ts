import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setModule: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: { getState: () => ({ setModule: mocks.setModule }) },
}));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ path: 'users/user-1/remote-relay/state' })),
    getDoc: (...args: unknown[]) => mocks.getDoc(...args),
}));
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-1' } },
    db: {},
}));
vi.mock('../RemoteRelayService', () => ({
    isFreshStudioState: vi.fn((state: { listenerReady?: boolean } | null) => state?.listenerReady === true),
}));

import { RemoteSupportTools } from './RemoteSupportTools';

describe('RemoteSupportTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/');
    });

    it('opens the Remote settings deep link without returning credentials', async () => {
        const result = await RemoteSupportTools.open_remote_setup({});
        expect(mocks.setModule).toHaveBeenCalledWith('settings');
        expect(window.location.search).toBe('?section=remote');
        expect(JSON.stringify(result)).not.toMatch(/token|secret|pairingCode|deviceId/i);
    });

    it('returns only a bounded remote status projection', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                online: true,
                listenerReady: true,
                protocolVersion: 1,
                leaseToken: 'must-not-leak',
                executorDeviceId: 'must-not-leak',
            }),
        });

        const result = await RemoteSupportTools.get_remote_status({});
        expect(result).toMatchObject({ success: true });
        expect(JSON.stringify(result)).not.toContain('must-not-leak');
    });
});
