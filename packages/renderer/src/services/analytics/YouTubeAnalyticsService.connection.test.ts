import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
    auth: {
        currentUser: {
            uid: 'user-a',
            providerData: [{ providerId: 'google.com' }],
        },
    },
}));

vi.mock('@/services/firebase', () => firebase);
vi.mock('firebase/auth', () => ({
    GoogleAuthProvider: class {
        static credentialFromResult = vi.fn();
        addScope() {}
        setCustomParameters() {}
    },
    reauthenticateWithPopup: vi.fn(),
    linkWithPopup: vi.fn(),
    signInWithPopup: vi.fn(),
}));

import { YouTubeAnalyticsService } from './YouTubeAnalyticsService';

describe('YouTubeAnalyticsService connection state', () => {
    beforeEach(() => {
        sessionStorage.clear();
        firebase.auth.currentUser = {
            uid: 'user-a',
            providerData: [{ providerId: 'google.com' }],
        };
    });

    it('does not treat ordinary Google sign-in as YouTube authorization', async () => {
        const service = new YouTubeAnalyticsService();

        await expect(service.isConnected()).resolves.toBe(false);
    });

    it('reports connected only for an unexpired token owned by the current account', async () => {
        sessionStorage.setItem('yt_google_access_token:user-a', 'token-a');
        sessionStorage.setItem('yt_google_token_expiry:user-a', String(Date.now() + 10 * 60_000));
        sessionStorage.setItem('yt_google_access_token:user-b', 'token-b');
        sessionStorage.setItem('yt_google_token_expiry:user-b', String(Date.now() + 10 * 60_000));

        const service = new YouTubeAnalyticsService();
        await expect(service.isConnected()).resolves.toBe(true);

        firebase.auth.currentUser = {
            uid: 'user-b',
            providerData: [{ providerId: 'google.com' }],
        };
        sessionStorage.removeItem('yt_google_access_token:user-b');
        await expect(service.isConnected()).resolves.toBe(false);
    });

    it('rejects expired or malformed token expiries', async () => {
        const service = new YouTubeAnalyticsService();
        sessionStorage.setItem('yt_google_access_token:user-a', 'token-a');
        sessionStorage.setItem('yt_google_token_expiry:user-a', String(Date.now() - 1));
        await expect(service.isConnected()).resolves.toBe(false);

        sessionStorage.setItem('yt_google_token_expiry:user-a', 'not-a-number');
        await expect(service.isConnected()).resolves.toBe(false);
    });

    it('links Google identity when user signed up with password', async () => {
        const { linkWithPopup, GoogleAuthProvider } = await import('firebase/auth');
        const mockLink = vi.mocked(linkWithPopup).mockResolvedValue({} as never);
        vi.mocked(GoogleAuthProvider.credentialFromResult).mockReturnValue({
            accessToken: 'scoped-yt-token',
        } as never);

        firebase.auth.currentUser = {
            uid: 'password-user',
            providerData: [{ providerId: 'password' }],
        };

        const service = new YouTubeAnalyticsService();
        await service.requestYouTubeAccess();

        expect(mockLink).toHaveBeenCalled();
        expect(sessionStorage.getItem('yt_google_access_token:password-user')).toBe('scoped-yt-token');
        await expect(service.isConnected()).resolves.toBe(true);
    });

    it('propagates failure and never falls back to signInWithPopup when linkWithPopup fails', async () => {
        const { linkWithPopup, signInWithPopup } = await import('firebase/auth');
        vi.mocked(linkWithPopup).mockRejectedValueOnce(new Error('auth/credential-already-in-use'));

        firebase.auth.currentUser = {
            uid: 'password-user',
            providerData: [{ providerId: 'password' }],
        };

        const service = new YouTubeAnalyticsService();
        await expect(service.requestYouTubeAccess()).rejects.toThrow('auth/credential-already-in-use');
        expect(signInWithPopup).not.toHaveBeenCalled();
    });
});
