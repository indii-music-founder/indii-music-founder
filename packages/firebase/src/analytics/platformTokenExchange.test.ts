import { describe, expect, it } from 'vitest';
import { resolveAnalyticsOAuthRedirectUri } from './platformTokenExchange';

describe('resolveAnalyticsOAuthRedirectUri', () => {
    it('accepts only the canonical callback for the requested platform', () => {
        delete process.env.APP_URL;
        delete process.env.FUNCTIONS_EMULATOR;

        expect(resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://app.indii.music/auth/spotify/callback',
        )).toBe('https://app.indii.music/auth/spotify/callback');

        expect(resolveAnalyticsOAuthRedirectUri(
            'tiktok',
            'https://app.indii.music/auth/tiktok/callback',
        )).toBe('https://app.indii.music/auth/tiktok/callback');

        expect(resolveAnalyticsOAuthRedirectUri(
            'instagram',
            'https://app.indii.music/auth/instagram/callback',
        )).toBe('https://app.indii.music/auth/instagram/callback');

        expect(() => resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://app.indii.music/auth/tiktok/callback',
        )).toThrow('does not match');

        expect(() => resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://attacker.example/auth/spotify/callback',
        )).toThrow('not an authorized');
    });

    it('rejects URLs with query parameters or hash fragments', () => {
        delete process.env.APP_URL;
        delete process.env.FUNCTIONS_EMULATOR;

        expect(() => resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://app.indii.music/auth/spotify/callback?admin=true',
        )).toThrow('does not match');

        expect(() => resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://app.indii.music/auth/spotify/callback#access_token=xyz',
        )).toThrow('does not match');
    });

    it('accepts an explicitly configured HTTPS Studio origin from APP_URL', () => {
        process.env.APP_URL = 'https://studio.indii.music';

        expect(resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'https://studio.indii.music/auth/spotify/callback',
        )).toBe('https://studio.indii.music/auth/spotify/callback');

        delete process.env.APP_URL;
    });

    it('accepts localhost only in the Functions emulator', () => {
        process.env.FUNCTIONS_EMULATOR = 'true';

        expect(resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'http://localhost:4242/auth/spotify/callback',
        )).toBe('http://localhost:4242/auth/spotify/callback');

        delete process.env.FUNCTIONS_EMULATOR;

        expect(() => resolveAnalyticsOAuthRedirectUri(
            'spotify',
            'http://localhost:4242/auth/spotify/callback',
        )).toThrow('not an authorized');
    });
});
