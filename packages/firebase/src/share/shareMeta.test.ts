import { describe, expect, it, vi } from 'vitest';

vi.mock('../marketing/presaveCampaigns', () => ({ getPublicPreSaveCampaign: vi.fn() }));
vi.mock('../functions/security/arcjet', () => ({ protectAnonymousSignupRequest: vi.fn().mockResolvedValue({ allowed: true }) }));

import { injectShareMeta, parseShareRoute, resolveOrigin, resolveShareMeta } from './shareMeta';

const passportCode = Buffer.from(JSON.stringify({ v: 1, c: 'Building momentum', g: 'Electronic / Dance', p: 'ASCAP', m: 'No', d: 'DistroKid', r: 'Mixing or mastering', o: [] })).toString('base64url');

const SHELL = `<!doctype html>
<html>
  <head>
    <title>indii.music — music business at the speed of you</title>
    <meta name="description" content="Generic" />
    <meta property="og:title" content="Generic" />
    <meta
      property="og:description"
      content="Generic multi-line"
    />
    <meta property="og:image" content="https://indii.music/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@indiidotmusic" />
    <meta name="twitter:image" content="https://indii.music/og-image.png" />
    <script type="module" src="/assets/app.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('parseShareRoute', () => {
    it('recognizes presave and passport paths only', () => {
        expect(parseShareRoute('/presave/abcDEF12_-')).toEqual({ kind: 'presave', campaignId: 'abcDEF12_-' });
        expect(parseShareRoute(`/passport/r/${passportCode}/`)).toEqual({ kind: 'passport', code: passportCode });
        expect(parseShareRoute('/presave/short')).toBeNull();
        expect(parseShareRoute('/presave/../../etc')).toBeNull();
        expect(parseShareRoute('/passport')).toBeNull();
    });
});

describe('resolveOrigin', () => {
    const route = { kind: 'presave', campaignId: 'abcdefgh' } as const;
    it('trusts only indii / Firebase hosting hosts', () => {
        expect(resolveOrigin('app.indii.music', route)).toBe('https://app.indii.music');
        expect(resolveOrigin('indii-music-founder--pr910-abc.web.app', route)).toBe('https://indii-music-founder--pr910-abc.web.app');
        expect(resolveOrigin('evil.example.com', route)).toBe('https://app.indii.music');
        expect(resolveOrigin('indii.music.evil.com', route)).toBe('https://app.indii.music');
        expect(resolveOrigin(undefined, { kind: 'passport', code: 'x' })).toBe('https://indii.music');
    });
});

describe('injectShareMeta', () => {
    const meta = {
        title: 'Pre-save “Glass <Rain>”',
        description: 'Out "soon" & everywhere',
        url: 'https://app.indii.music/presave/abcdefgh',
        image: 'https://firebasestorage.googleapis.com/cover.jpg',
        imageAlt: 'Cover art',
    };

    it('replaces generic tags, keeps twitter:site, escapes values, and keeps the app shell', () => {
        const html = injectShareMeta(SHELL, meta);
        expect(html).not.toContain('Generic');
        expect(html).not.toContain('og-image.png');
        expect(html).toContain('<meta name="twitter:site" content="@indiidotmusic" />');
        expect(html).toContain('<title>Pre-save “Glass &lt;Rain&gt;”</title>');
        expect(html).toContain('content="Out &quot;soon&quot; &amp; everywhere"');
        expect(html).toContain('<meta property="og:image" content="https://firebasestorage.googleapis.com/cover.jpg" />');
        expect(html).not.toContain('og:image:width');
        expect(html.match(/property="og:title"/g)).toHaveLength(1);
        expect(html).toContain('<script type="module" src="/assets/app.js"></script>');
        expect(html).toContain('<div id="root"></div>');
    });
});

describe('resolveShareMeta', () => {
    const now = () => Date.UTC(2026, 10, 18);

    it('builds a presave preview from cover art and release date', async () => {
        const meta = await resolveShareMeta({ kind: 'presave', campaignId: 'abcdefgh' }, 'https://app.indii.music', {
            getPresave: async () => ({ title: 'Glass Rain', releaseDate: Date.UTC(2026, 10, 30), coverArtUrl: 'https://cdn.example/cover.jpg' }),
            now,
        });
        expect(meta).toMatchObject({
            title: 'Pre-save “Glass Rain”',
            description: 'Out November 30, 2026. Pre-save it on Spotify, Apple Music or Amazon Music.',
            url: 'https://app.indii.music/presave/abcdefgh',
            image: 'https://cdn.example/cover.jpg',
        });
        expect(meta?.imageSize).toBeUndefined();
    });

    it('falls back to the site image and flips to "out now" after release', async () => {
        const meta = await resolveShareMeta({ kind: 'presave', campaignId: 'abcdefgh' }, 'https://app.indii.music', {
            getPresave: async () => ({ title: 'Old Song', releaseDate: Date.UTC(2026, 0, 1), coverArtUrl: '' }),
            now,
        });
        expect(meta?.title).toBe('Old Song — out now');
        expect(meta?.image).toBe('https://app.indii.music/og-image.png');
        expect(meta?.imageSize).toEqual({ width: 1200, height: 630 });
    });

    it('builds a passport preview from the stage only', async () => {
        const getPresave = vi.fn();
        const meta = await resolveShareMeta({ kind: 'passport', code: passportCode }, 'https://indii.music', { getPresave });
        expect(meta).toMatchObject({
            title: 'Building momentum · Artist Passport',
            image: 'https://indii.music/og/passport-stage-02.jpg',
            url: `https://indii.music/passport/r/${passportCode}`,
        });
        expect(getPresave).not.toHaveBeenCalled();
    });

    it('returns null for an invalid passport code', async () => {
        const forged = Buffer.from(JSON.stringify({ v: 1, c: '<script>' })).toString('base64url');
        expect(await resolveShareMeta({ kind: 'passport', code: forged }, 'https://indii.music', { getPresave: vi.fn() })).toBeNull();
        expect(await resolveShareMeta({ kind: 'passport', code: 'garbage' }, 'https://indii.music', { getPresave: vi.fn() })).toBeNull();
    });
});
