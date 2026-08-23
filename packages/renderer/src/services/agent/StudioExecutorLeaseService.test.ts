import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const callables = vi.hoisted(() => ({
    issue: vi.fn().mockResolvedValue({
        data: {
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            expiresAt: Date.now() + 600_000,
        },
    }),
    publish: vi.fn().mockResolvedValue({ data: { ok: true } }),
    release: vi.fn().mockResolvedValue({ data: { ok: true } }),
    claim: vi.fn().mockResolvedValue({ data: { claimed: true } }),
    complete: vi.fn().mockResolvedValue({ data: { ok: true } }),
    publishResponse: vi.fn().mockResolvedValue({ data: { ok: true } }),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions: unknown, name: string) => {
        if (name === 'issueStudioExecutorLease') return callables.issue;
        if (name === 'publishStudioPresence') return callables.publish;
        if (name === 'releaseStudioPresence') return callables.release;
        if (name === 'claimStudioCommand') return callables.claim;
        if (name === 'publishStudioResponse') return callables.publishResponse;
        if (name === 'completeStudioCommand') return callables.complete;
        return vi.fn();
    }),
}));

vi.mock('@/services/firebase', () => ({ functions: {} }));

import { studioExecutorLeaseService } from './StudioExecutorLeaseService';
import { getStudioRelayHealth, resetStudioRelayHealth } from './studioRelayHealth';

describe('StudioExecutorLeaseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStudioRelayHealth();
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

    afterEach(() => {
        vi.useRealTimers();
    });

    it('publishes presence through the expiry-validating callable without copying the lease into state', async () => {
        const state = { studioInstanceId: 'studio-instance-001', currentModule: 'dashboard' };

        await studioExecutorLeaseService.publishPresence(state);

        expect(callables.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                deviceId: 'studio-device-0001',
                leaseToken: 'server-secret-token',
                state,
            })
        );
        expect(state).not.toHaveProperty('leaseToken');
    });

    it('claims a command by delegating lease identity + instance to the callable and returns its verdict', async () => {
        callables.claim.mockResolvedValue({ data: { claimed: true } });
        const claimed = await studioExecutorLeaseService.claimCommand('cmd-1', 'studio-instance-001');

        expect(claimed).toBe(true);
        expect(callables.claim).toHaveBeenCalledWith({
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            commandId: 'cmd-1',
            studioInstanceId: 'studio-instance-001',
        });

        callables.claim.mockResolvedValue({ data: { claimed: false } });
        expect(await studioExecutorLeaseService.claimCommand('cmd-2', 'studio-instance-001')).toBe(false);
    });

    it('marks completion and releases presence through the owning device identity', async () => {
        await studioExecutorLeaseService.completeCommand('cmd-9');
        await studioExecutorLeaseService.releasePresence('studio-instance-007');

        expect(callables.complete).toHaveBeenCalledWith({
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            commandId: 'cmd-9',
        });
        expect(callables.release).toHaveBeenCalledWith({
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            studioInstanceId: 'studio-instance-007',
        });
    });

    it('publishes responses under the lease identity with the full response payload', async () => {
        await studioExecutorLeaseService.publishResponse({
            commandId: 'cmd-5',
            text: 'Done — rendered two variants.',
            agentId: 'creative',
            imageUrls: ['https://cdn.example/a.png'],
            videoUrls: ['https://cdn.example/a.mp4'],
            isStreaming: false,
            boardroomMessageId: 'bm-77',
        });

        expect(callables.publishResponse).toHaveBeenCalledWith(expect.objectContaining({
            deviceId: 'studio-device-0001',
            leaseToken: 'server-secret-token',
            commandId: 'cmd-5',
            text: 'Done — rendered two variants.',
            agentId: 'creative',
            imageUrls: ['https://cdn.example/a.png'],
            videoUrls: ['https://cdn.example/a.mp4'],
            isStreaming: false,
            boardroomMessageId: 'bm-77',
        }));
    });

    it('feeds relay health from real publish outcomes so Settings never lies', async () => {
        await studioExecutorLeaseService.publishPresence({ studioInstanceId: 's1' });
        expect(getStudioRelayHealth()).toMatchObject({ consecutiveFailures: 0, lastErrorMessage: null });

        callables.publish.mockRejectedValueOnce(new Error('publishStudioPresence is not deployed'));
        await expect(studioExecutorLeaseService.publishPresence({ studioInstanceId: 's1' })).rejects.toThrow('not deployed');

        const health = getStudioRelayHealth();
        expect(health.consecutiveFailures).toBe(1);
        expect(health.lastErrorMessage).toContain('not deployed');
    });

    // ── Lease-cache lifecycle (run LAST: the singleton cache persists across
    // tests in this file, so these advance a SHARED clock one day per test —
    // each test's base outlives every earlier test's 10-minute lease.) ──

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    let clockBase = Date.now() + THIRTY_DAYS_MS;
    const advanceClock = () => {
        clockBase += 24 * 60 * 60 * 1000; // +1 day per cache test
        vi.useFakeTimers();
        vi.setSystemTime(new Date(clockBase));
        return clockBase;
    };

    it('caches the lease while more than 60s of validity remains', async () => {
        const t0 = advanceClock();
        callables.issue.mockResolvedValue({
            data: { deviceId: 'studio-device-0001', leaseToken: 'token-a', expiresAt: t0 + 600_000 },
        });

        const first = await studioExecutorLeaseService.getLease();
        const second = await studioExecutorLeaseService.getLease();

        expect(callables.issue).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
        expect(second.leaseToken).toBe('token-a');
    });

    it('re-issues when the cached lease is within 60s of expiry', async () => {
        const t0 = advanceClock(); // strictly after every earlier test's lease expiry
        callables.issue
            .mockResolvedValueOnce({ data: { deviceId: 'studio-device-0001', leaseToken: 'token-a', expiresAt: t0 + 600_000 } })
            .mockResolvedValueOnce({ data: { deviceId: 'studio-device-0001', leaseToken: 'token-b', expiresAt: t0 + 600_000 } });

        await studioExecutorLeaseService.getLease();
        // 541s later only 59s of validity remains — below the 60s cache floor.
        vi.setSystemTime(new Date(t0 + 541_000));
        const renewed = await studioExecutorLeaseService.getLease();

        expect(callables.issue).toHaveBeenCalledTimes(2);
        expect(renewed.leaseToken).toBe('token-b');
    });

    it('refuses to act outside the Electron bridge — the browser can never hold a lease', async () => {
        advanceClock(); // invalidate any prior cache
        Object.defineProperty(window, 'electronAPI', { configurable: true, value: {} });

        await expect(studioExecutorLeaseService.getLease()).rejects.toThrow(/only be issued inside the Electron Studio/);
        expect(callables.issue).not.toHaveBeenCalled();
    });
});
