import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getMediaAccessStatus: vi.fn(() => 'granted'),
    isTrustedAccessibilityClient: vi.fn(() => true),
    isAllowed: vi.fn(() => false)
}));

vi.mock('electron', () => ({
    systemPreferences: {
        getMediaAccessStatus: mocks.getMediaAccessStatus,
        isTrustedAccessibilityClient: mocks.isTrustedAccessibilityClient
    }
}));

vi.mock('./computer/ComputerAllowlistStore', () => ({
    computerAllowlistStore: { isAllowed: mocks.isAllowed }
}));

import { ComputerExecutionService } from './ComputerExecutionService';
import type { ComputerProvider } from './computer/ComputerProvider';

function fakeProvider(): ComputerProvider {
    return {
        capabilities: () => ({ screenshot: true, apps: true, input: true }),
        screenshot: vi.fn().mockResolvedValue({ base64: '', width: 1, height: 1, displayId: 1 }),
        listApps: vi.fn().mockResolvedValue([]),
        openApp: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        key: vi.fn().mockResolvedValue(undefined),
        scroll: vi.fn().mockResolvedValue(undefined)
    };
}

describe('ComputerExecutionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('kill switch (ISSUE-1111)', () => {
        it('blocks click/type/key/scroll after abort() until resetAbort()', async () => {
            const provider = fakeProvider();
            const svc = new ComputerExecutionService(provider);

            svc.abort();
            expect(svc.isAborted()).toBe(true);

            await expect(svc.click(1, 1, 'left')).rejects.toThrow(/kill switch/i);
            await expect(svc.type('x')).rejects.toThrow(/kill switch/i);
            await expect(svc.key('return')).rejects.toThrow(/kill switch/i);
            await expect(svc.scroll(1, 1)).rejects.toThrow(/kill switch/i);
            expect(provider.click).not.toHaveBeenCalled();

            svc.resetAbort();
            expect(svc.isAborted()).toBe(false);
            await svc.click(1, 1, 'left');
            expect(provider.click).toHaveBeenCalledWith(1, 1, 'left');
        });

        it('does not block the read path (screenshot/listApps) when aborted', async () => {
            const provider = fakeProvider();
            const svc = new ComputerExecutionService(provider);
            svc.abort();
            await expect(svc.screenshot()).resolves.toBeDefined();
            await expect(svc.listApps()).resolves.toEqual([]);
        });
    });

    describe('app allowlist (ISSUE-1111, fail-closed)', () => {
        it('rejects openApp when the allowlist store denies the app', async () => {
            mocks.isAllowed.mockReturnValue(false);
            const provider = fakeProvider();
            const svc = new ComputerExecutionService(provider);
            await expect(svc.openApp('Safari')).rejects.toThrow(/not on the computer-control allowlist/);
            expect(provider.openApp).not.toHaveBeenCalled();
        });

        it('delegates to the provider when the allowlist store allows the app', async () => {
            mocks.isAllowed.mockReturnValue(true);
            const provider = fakeProvider();
            const svc = new ComputerExecutionService(provider);
            await svc.openApp('Safari');
            expect(provider.openApp).toHaveBeenCalledWith('Safari');
        });
    });

    describe('unsupported platform', () => {
        it('throws on every provider-backed method when the provider is null', async () => {
            const svc = new ComputerExecutionService(null);
            expect(svc.isSupported()).toBe(false);
            await expect(svc.screenshot()).rejects.toThrow(/not supported on this platform/);
            await expect(svc.click(1, 1, 'left')).rejects.toThrow(/not supported on this platform/);
        });

        it('reports unsupported permission status without touching systemPreferences guidance path', () => {
            const svc = new ComputerExecutionService(null);
            const status = svc.getPermissionStatus();
            expect(status.supported).toBe(false);
            expect(status.guidance[0]).toMatch(/no provider/i);
        });
    });

    describe('permission status (darwin, provider present)', () => {
        // getPermissionStatus() branches on the real process.platform; force it deterministically
        // so this suite passes identically on macOS and non-macOS CI runners.
        let platformSpy: ReturnType<typeof vi.spyOn>;
        beforeEach(() => {
            platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
        });
        afterEach(() => {
            platformSpy.mockRestore();
        });

        it('surfaces granted status with no guidance when both permissions are granted', () => {
            mocks.getMediaAccessStatus.mockReturnValue('granted');
            mocks.isTrustedAccessibilityClient.mockReturnValue(true);
            const svc = new ComputerExecutionService(fakeProvider());
            const status = svc.getPermissionStatus();
            expect(status.screenRecording).toBe('granted');
            expect(status.accessibility).toBe('granted');
            expect(status.guidance).toHaveLength(0);
        });

        it('surfaces actionable guidance when accessibility is denied', () => {
            mocks.getMediaAccessStatus.mockReturnValue('granted');
            mocks.isTrustedAccessibilityClient.mockReturnValue(false);
            const svc = new ComputerExecutionService(fakeProvider());
            const status = svc.getPermissionStatus();
            expect(status.accessibility).toBe('denied');
            expect(status.guidance.some(g => /Accessibility/.test(g))).toBe(true);
        });
    });

    describe('permission status (win32, provider present) — CE-5, ISSUE-1114', () => {
        let platformSpy: ReturnType<typeof vi.spyOn>;
        beforeEach(() => {
            platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
        });
        afterEach(() => {
            platformSpy.mockRestore();
        });

        it('reports supported+granted without a TCC-style preflight (no permission model on Windows)', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            const status = svc.getPermissionStatus();
            expect(status.supported).toBe(true);
            expect(status.screenRecording).toBe('granted');
            expect(status.accessibility).toBe('granted');
            expect(status.guidance).toHaveLength(0);
            // Windows has no TCC prompt to check — must not call the macOS-only APIs.
            expect(mocks.getMediaAccessStatus).not.toHaveBeenCalled();
            expect(mocks.isTrustedAccessibilityClient).not.toHaveBeenCalled();
        });
    });

    describe('session-scoped approval grants (CE-5, ISSUE-1114)', () => {
        it('has no active grant for a session that was never granted', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            expect(svc.hasActiveGrant('session-a')).toBe(false);
            expect(svc.getGrant('session-a')).toBeUndefined();
        });

        it('grantSession makes hasActiveGrant true and returns the grant record', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            const grant = svc.grantSession('session-a', 60_000);
            expect(grant.sessionId).toBe('session-a');
            expect(grant.expiresAt).toBeGreaterThan(grant.grantedAt);
            expect(svc.hasActiveGrant('session-a')).toBe(true);
            expect(svc.getGrant('session-a')).toEqual(grant);
        });

        it('revokeGrant immediately clears an active grant', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            svc.grantSession('session-a');
            expect(svc.hasActiveGrant('session-a')).toBe(true);
            svc.revokeGrant('session-a');
            expect(svc.hasActiveGrant('session-a')).toBe(false);
        });

        it('a grant expires after its TTL and hasActiveGrant reports false past expiry', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            const grant = svc.grantSession('session-a', 1000);
            expect(svc.hasActiveGrant('session-a', grant.grantedAt + 500)).toBe(true);
            expect(svc.hasActiveGrant('session-a', grant.grantedAt + 1001)).toBe(false);
        });

        it('grants are independent per session id', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            svc.grantSession('session-a');
            expect(svc.hasActiveGrant('session-a')).toBe(true);
            expect(svc.hasActiveGrant('session-b')).toBe(false);
        });

        it('grantSession without an explicit ttlMs uses a sane non-zero default', () => {
            const svc = new ComputerExecutionService(fakeProvider());
            const grant = svc.grantSession('session-default');
            expect(grant.expiresAt - grant.grantedAt).toBeGreaterThan(0);
        });
    });
});
