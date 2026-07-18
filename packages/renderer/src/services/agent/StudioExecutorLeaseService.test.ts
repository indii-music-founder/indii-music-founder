import { beforeEach, describe, expect, it, vi } from 'vitest';

const callables = vi.hoisted(() => ({
    issue: vi.fn().mockResolvedValue({
        data: {
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            expiresAt: Date.now() + 600_000,
        },
    }),
    publish: vi.fn().mockResolvedValue({ data: { ok: true } }),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions: unknown, name: string) => {
        if (name === 'issueStudioExecutorLease') return callables.issue;
        if (name === 'publishStudioPresence') return callables.publish;
        return vi.fn();
    }),
}));

vi.mock('@/services/firebase', () => ({ functions: {} }));

import { REMOTE_RELAY_PROTOCOL_VERSION, studioExecutorLeaseService } from './StudioExecutorLeaseService';

describe('StudioExecutorLeaseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'electronAPI', {
            configurable: true,
            value: {
                credentials: {
                    get: vi.fn().mockResolvedValue({
                        apiKey: 'studio-device-0001',
                        apiSecret: 'enrollment-secret-000000000000000',
                    }),
                    save: vi.fn(),
                },
            },
        });
    });

    it('publishes presence through the expiry-validating callable without copying the lease into state', async () => {
        const state = { studioInstanceId: 'studio-instance-001', currentModule: 'dashboard' };

        await studioExecutorLeaseService.publishPresence(state);

        expect(callables.publish).toHaveBeenCalledWith({
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            protocolVersion: REMOTE_RELAY_PROTOCOL_VERSION,
            state,
        });
        expect(state).not.toHaveProperty('leaseToken');
    });
});
