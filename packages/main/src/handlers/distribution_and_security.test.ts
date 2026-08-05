import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    authStorage: {
        getAuthenticatedUserId: vi.fn(),
        getToken: vi.fn(),
    },
    credentialService: {
        saveCredentials: vi.fn().mockResolvedValue(undefined),
        getCredentials: vi.fn().mockResolvedValue(null),
    }
}));

vi.mock('libsodium-wrappers', () => ({
    default: {
        ready: Promise.resolve(),
        from_base64: vi.fn(),
        from_string: vi.fn(),
        crypto_box_seal: vi.fn(),
        to_base64: vi.fn(),
        base64_variants: { ORIGINAL: 1 }
    }
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        getPath: vi.fn(() => '/mock/user-data'),
        isPackaged: false
    }
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

vi.mock('../services/AuthStorage', () => ({
    authStorage: mocks.authStorage
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

import { setupDistributionHandlers } from './distribution';
import { registerSecurityHandlers } from './security';

describe('🛡️ Session Identity & Credential Isolation Tests', () => {
    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
        mocks.ipcMain.handle.mockImplementation((channel: string, listener: unknown) => {
            handlers.set(channel, listener as (...args: unknown[]) => Promise<unknown>);
            return mocks.ipcMain;
        });

        setupDistributionHandlers();
        registerSecurityHandlers();
    });

    it('should derive user identity from desktop session in tax calculation', async () => {
        mocks.authStorage.getAuthenticatedUserId.mockResolvedValue('session-user-777');
        const handler = handlers.get('distribution:calculate-tax');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'file:///app/index.html' } };
        // Even if caller passes a forged userId, session userId should take precedence
        const res = await handler!(fakeEvent, { userId: 'forged-user-999', amount: 500 });
        expect(res).toBeDefined();
        expect(mocks.authStorage.getAuthenticatedUserId).toHaveBeenCalled();
    });

    it('should NEVER return raw secret material to renderer on credential rotation', async () => {
        const handler = handlers.get('security:rotate-credentials');
        expect(handler).toBeDefined();

        // Mock global fetch for Stripe restricted_keys endpoint
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ key: 'rk_live_SECRET_STRIPE_KEY_12345' }),
            text: async () => ''
        } as Response);

        const fakeEvent = { senderFrame: { url: 'file:///app/index.html' } };
        const res = await handler!(fakeEvent, {
            serviceName: 'stripe',
            vaultData: { api_secret: 'sk_live_OLD_SECRET' }
        }) as Record<string, unknown>;

        expect(res.success).toBe(true);
        expect(res.credentialId).toBeDefined();
        // Crucial security invariant: raw secret key MUST NOT be returned in IPC response
        expect(res.newKey).toBeUndefined();
        expect(mocks.credentialService.saveCredentials).toHaveBeenCalledWith(
            res.credentialId,
            expect.objectContaining({ apiSecret: 'rk_live_SECRET_STRIPE_KEY_12345' })
        );
    });
});
