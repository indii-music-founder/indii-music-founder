import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEmailOAuthRedirectUri, verifyProviderAccount } from './tokenManager';

const originalAppUrl = process.env.APP_URL;
const originalEmulator = process.env.FUNCTIONS_EMULATOR;

afterEach(() => {
    vi.unstubAllGlobals();
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = originalEmulator;
});

describe('verifyProviderAccount', () => {
    it('requires a real provider profile before reporting Gmail connected', async () => {
        const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            emailAddress: 'artist@example.com',
        }), { status: 200 }));
        vi.stubGlobal('fetch', providerFetch);

        await expect(verifyProviderAccount('gmail', 'short-lived-access', {
            email: 'artist@example.com',
            name: 'Artist Name',
            picture: 'https://images.example/avatar.png',
        })).resolves.toEqual({
            id: 'gmail',
            provider: 'gmail',
            email: 'artist@example.com',
            displayName: 'Artist Name',
            avatarUrl: 'https://images.example/avatar.png',
            isConnected: true,
            lastSyncAt: null,
        });
    });

    it('fails closed when a provider rejects profile verification', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

        await expect(verifyProviderAccount('outlook', 'invalid-access', {}))
            .rejects.toThrow('profile verification failed (401)');
    });
});

describe('resolveEmailOAuthRedirectUri', () => {
    it('accepts only the canonical callback for the requested provider', () => {
        delete process.env.APP_URL;
        delete process.env.FUNCTIONS_EMULATOR;

        expect(resolveEmailOAuthRedirectUri(
            'gmail',
            'https://app.indii.music/auth/gmail/callback',
        )).toBe('https://app.indii.music/auth/gmail/callback');
        expect(() => resolveEmailOAuthRedirectUri(
            'gmail',
            'https://app.indii.music/auth/outlook/callback',
        )).toThrow('does not match');
        expect(() => resolveEmailOAuthRedirectUri(
            'gmail',
            'https://attacker.example/auth/gmail/callback',
        )).toThrow('not an authorized');
    });

    it('accepts an explicitly configured HTTPS Studio origin', () => {
        process.env.APP_URL = 'https://studio.indii.music';

        expect(resolveEmailOAuthRedirectUri(
            'outlook',
            'https://studio.indii.music/auth/outlook/callback',
        )).toBe('https://studio.indii.music/auth/outlook/callback');
    });

    it('accepts localhost only in the Functions emulator', () => {
        process.env.FUNCTIONS_EMULATOR = 'true';

        expect(resolveEmailOAuthRedirectUri(
            'gmail',
            'http://localhost:4243/auth/gmail/callback',
        )).toBe('http://localhost:4243/auth/gmail/callback');
        delete process.env.FUNCTIONS_EMULATOR;
        expect(() => resolveEmailOAuthRedirectUri(
            'gmail',
            'http://localhost:4243/auth/gmail/callback',
        )).toThrow('not an authorized');
    });
});
