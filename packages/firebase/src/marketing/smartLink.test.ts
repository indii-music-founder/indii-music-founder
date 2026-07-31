import { describe, expect, it } from 'vitest';

import { hashClientIp, isSafeDestination, resolveDestination, type SmartLinkDoc } from './smartLink.js';

/**
 * The redirect handler itself is exercised end-to-end by the emulator suite.
 * These cover the pure decisions inside it, where the security and privacy
 * properties actually live.
 */

const LINK: SmartLinkDoc = {
    artistId: 'artist-uid',
    defaultUrl: 'https://open.spotify.com/album/xyz',
    destinations: {
        spotify: 'https://open.spotify.com/album/xyz',
        apple: 'https://music.apple.com/album/xyz',
    },
    campaignId: 'camp-1',
};

describe('isSafeDestination', () => {
    it('accepts http and https', () => {
        expect(isSafeDestination('https://open.spotify.com/x')).toBe(true);
        expect(isSafeDestination('http://example.com')).toBe(true);
    });

    it('rejects schemes that would turn the redirect into an attack vector', () => {
        // An open redirect on our domain lends our reputation to a phishing hop.
        for (const url of [
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'file:///etc/passwd',
            'ftp://example.com',
        ]) {
            expect(isSafeDestination(url)).toBe(false);
        }
    });

    it('rejects relative and malformed URLs', () => {
        expect(isSafeDestination('/relative/path')).toBe(false);
        expect(isSafeDestination('not a url')).toBe(false);
        expect(isSafeDestination('')).toBe(false);
    });
});

describe('resolveDestination', () => {
    it('honours an explicit DSP choice', () => {
        expect(resolveDestination(LINK, 'apple')).toBe('https://music.apple.com/album/xyz');
    });

    it('falls back to the default for an unknown DSP', () => {
        expect(resolveDestination(LINK, 'bandcamp')).toBe(LINK.defaultUrl);
    });

    it('falls back to the default when no DSP is given', () => {
        expect(resolveDestination(LINK, undefined)).toBe(LINK.defaultUrl);
    });

    it('returns null when the stored destination is unsafe', () => {
        // Destinations are artist-supplied; the check has to happen at read
        // time, not only at write time.
        expect(resolveDestination(
            { ...LINK, defaultUrl: 'javascript:alert(1)', destinations: {} },
            undefined,
        )).toBeNull();
    });

    it('returns null rather than falling through when the chosen DSP is unsafe', () => {
        expect(resolveDestination(
            { ...LINK, destinations: { apple: 'javascript:alert(1)' } },
            'apple',
        )).toBeNull();
    });
});

describe('hashClientIp', () => {
    it('is stable within a day', () => {
        expect(hashClientIp('203.0.113.5', '2026-07-31'))
            .toBe(hashClientIp('203.0.113.5', '2026-07-31'));
    });

    it('cannot be joined across days', () => {
        // The daily salt is what keeps this from accumulating into a durable
        // identifier for a person.
        expect(hashClientIp('203.0.113.5', '2026-07-31'))
            .not.toBe(hashClientIp('203.0.113.5', '2026-08-01'));
    });

    it('separates different clients', () => {
        expect(hashClientIp('203.0.113.5', '2026-07-31'))
            .not.toBe(hashClientIp('203.0.113.6', '2026-07-31'));
    });

    it('never returns the raw address', () => {
        const hashed = hashClientIp('203.0.113.5', '2026-07-31');
        expect(hashed).not.toContain('203.0.113.5');
        expect(hashed).toMatch(/^[a-f0-9]{32}$/);
    });
});
