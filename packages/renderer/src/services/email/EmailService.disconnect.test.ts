import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revokeCallable, httpsCallable } = vi.hoisted(() => {
    const callable = vi.fn();
    return {
        revokeCallable: callable,
        httpsCallable: vi.fn(() => callable),
    };
});

vi.mock('firebase/functions', () => ({ httpsCallable }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    setDoc: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-a', email: 'artist@example.com' } },
    db: {},
    functions: {},
}));

import { EmailService } from './EmailService';
import { setDoc } from 'firebase/firestore';

describe('EmailService.disconnectAccount', () => {
    beforeEach(() => {
        revokeCallable.mockReset();
        httpsCallable.mockClear();
        EmailService.clearSession();
    });

    it('revokes the server-held credential instead of attempting a denied client delete', async () => {
        revokeCallable.mockResolvedValue({ data: { success: true } });

        await EmailService.disconnectAccount('gmail');

        expect(httpsCallable).toHaveBeenCalledWith({}, 'emailRevokeToken');
        expect(revokeCallable).toHaveBeenCalledWith({ provider: 'gmail' });
    });

    it('does not report disconnect when the backend did not confirm revocation', async () => {
        revokeCallable.mockResolvedValue({ data: { success: false } });

        await expect(EmailService.disconnectAccount('outlook')).rejects.toThrow('Failed to revoke');
    });

    it('accepts only backend-verified account metadata after OAuth exchange', async () => {
        revokeCallable.mockResolvedValue({
            data: {
                accessToken: 'short-lived-access',
                expiresAt: Date.now() + 60_000,
                scope: 'mail.read',
                provider: 'gmail',
                account: {
                    id: 'gmail',
                    provider: 'gmail',
                    email: 'artist@example.com',
                    displayName: 'Artist',
                    avatarUrl: '',
                    isConnected: true,
                    lastSyncAt: null,
                },
            },
        });

        await EmailService.handleAuthCallback('gmail', 'authorization-code', 'user-a');

        expect(revokeCallable).toHaveBeenCalledWith({
            code: 'authorization-code',
            provider: 'gmail',
            redirectUri: `${window.location.origin}/auth/gmail/callback`,
        });
        expect(setDoc).not.toHaveBeenCalled();
    });
});
