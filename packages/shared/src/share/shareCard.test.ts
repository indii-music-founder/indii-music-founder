// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
    FREQUENCY_PALETTE,
    SHARE_ATTRIBUTION,
    buildShareCardModel,
    describeCountdown,
    displayUrl,
    shareCardFileName,
} from './shareCardTemplates';
import { computeCoverCrop, wrapText } from './ShareCardRenderer';
import { canShareFiles, shareOrDownloadImage } from './shareFile';

const NOW = new Date(2026, 10, 18, 15, 30); // Nov 18 2026, local afternoon

describe('computeCoverCrop', () => {
    it('center-crops landscape and portrait cover images to a square without stretching', () => {
        expect(computeCoverCrop(1920, 1080, 520, 520)).toEqual({ x: 420, y: 0, w: 1080, h: 1080 });
        expect(computeCoverCrop(1080, 1920, 520, 520)).toEqual({ x: 0, y: 420, w: 1080, h: 1080 });
        expect(computeCoverCrop(1000, 1000, 520, 520)).toEqual({ x: 0, y: 0, w: 1000, h: 1000 });
    });
});

describe('describeCountdown', () => {
    it('counts calendar days, not 24h windows', () => {
        expect(describeCountdown('2026-11-30', NOW)).toBe('Out in 12 days');
        expect(describeCountdown('2026-11-19', NOW)).toBe('Out tomorrow');
        expect(describeCountdown('2026-11-18', NOW)).toBe('Out today');
        expect(describeCountdown('2026-11-01', NOW)).toBe('Out now');
    });

    it('accepts epoch milliseconds', () => {
        expect(describeCountdown(new Date(2026, 10, 25, 0, 0).getTime(), NOW)).toBe('Out in 7 days');
    });

    it('returns undefined for unparseable dates', () => {
        expect(describeCountdown('not a date', NOW)).toBeUndefined();
        expect(describeCountdown(Number.NaN, NOW)).toBeUndefined();
    });
});

describe('buildShareCardModel', () => {
    it('builds a presave card with countdown, artist and clean link', () => {
        const model = buildShareCardModel(
            { kind: 'presave', artistName: '  Nova  Reign ', trackTitle: 'Glass Rain', releaseDate: '2026-11-30', url: 'https://indii.music/presave/abc12345/' },
            { now: NOW },
        );
        expect(model.eyebrow).toBe('Pre-save now');
        expect(model.title).toBe('Glass Rain');
        expect(model.subtitle).toBe('Nova Reign');
        expect(model.callout).toBe('Out in 12 days · November 30, 2026');
        expect(model.url).toBe('indii.music/presave/abc12345');
        expect(model.attribution).toBe(SHARE_ATTRIBUTION);
    });

    it('flips past presaves to "Out now"', () => {
        const model = buildShareCardModel({ kind: 'presave', trackTitle: 'Old', releaseDate: '2026-01-01' }, { now: NOW });
        expect(model.eyebrow).toBe('Out now');
        expect(model.callout).toBe('January 1, 2026');
    });

    it('uses valid brand colors and falls back to Frequency tokens', () => {
        const branded = buildShareCardModel({ kind: 'milestone', headline: 'First release' }, { brandColors: ['nope', '#112233', '#abc'] });
        expect([branded.accentFrom, branded.accentTo]).toEqual(['#112233', '#abc']);
        const fallback = buildShareCardModel({ kind: 'milestone', headline: 'First release' }, { brandColors: ['red'] });
        expect([fallback.accentFrom, fallback.accentTo]).toEqual([FREQUENCY_PALETTE.resonanceBlue, FREQUENCY_PALETTE.frequencyPink]);
    });

    it('rejects unsafe cover and link schemes', () => {
        const model = buildShareCardModel({ kind: 'release', trackTitle: 'X', coverArtUrl: 'javascript:alert(1)', url: 'javascript:alert(1)' });
        expect(model.coverArtUrl).toBeUndefined();
        expect(model.url).toBeUndefined();
        expect(displayUrl('ftp://example.com/a')).toBeUndefined();
    });

    it('truncates very long titles and can hide attribution', () => {
        const model = buildShareCardModel({ kind: 'release', trackTitle: 'a'.repeat(200) }, { showAttribution: false });
        expect(model.title.length).toBe(80);
        expect(model.title.endsWith('…')).toBe(true);
        expect(model.attribution).toBe('');
    });

    it('falls back to a generic title when blank', () => {
        expect(buildShareCardModel({ kind: 'release', trackTitle: '   ' }).title).toBe('New music');
    });
});

describe('passport template', () => {
    it('builds the passport card', () => {
        const model = buildShareCardModel({ kind: 'passport', stageBadge: 'STAGE 02', stageTitle: 'Building momentum', finding: 'Dual-Royalty Foundation Established', url: 'https://indii.music/passport/r/abc' });
        expect(model.eyebrow).toBe('Artist Passport · STAGE 02');
        expect(model.title).toBe('Building momentum');
        expect(model.callout).toBe('Dual-Royalty Foundation Established');
        expect(model.url).toBe('indii.music/passport/r/abc');
    });
});

describe('shareCardFileName', () => {
    it('slugifies the title per size', () => {
        const model = buildShareCardModel({ kind: 'release', trackTitle: 'Café Nights!! (Remix)' });
        expect(shareCardFileName(model, 'story')).toBe('cafe-nights-remix-story.png');
        expect(shareCardFileName(buildShareCardModel({ kind: 'release', trackTitle: '★★★' }), 'og')).toBe('indii-og.png');
    });
});

describe('wrapText', () => {
    const measure = (text: string) => text.length * 10; // 10px per char

    it('wraps on word boundaries', () => {
        expect(wrapText(measure, 'one two three four', 90, 3)).toEqual(['one two', 'three', 'four']);
    });

    it('ellipsizes overflow onto the last allowed line', () => {
        const lines = wrapText(measure, 'one two three four five six', 90, 2);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('one two');
        expect(lines[1].endsWith('…')).toBe(true);
        expect(measure(lines[1])).toBeLessThanOrEqual(90);
    });

    it('handles a single line limit and a single long word', () => {
        const single = wrapText(measure, 'alpha beta gamma', 80, 1);
        expect(single).toHaveLength(1);
        expect(single[0].endsWith('…')).toBe(true);
        expect(wrapText(measure, 'supercalifragilistic', 50, 2)[0].endsWith('…')).toBe(true);
    });
});

describe('shareOrDownloadImage', () => {
    const originalShare = navigator.share;
    const originalCanShare = navigator.canShare;

    afterEach(() => {
        Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true });
        vi.restoreAllMocks();
    });

    function stubDownload() {
        const createObjectURL = vi.fn(() => 'blob:mock');
        Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
        Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        return { createObjectURL, click };
    }

    it('downloads when the platform cannot share files', async () => {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        const { click } = stubDownload();
        const outcome = await shareOrDownloadImage(new Blob(['x'], { type: 'image/png' }), 'card.png', { title: 'Card' });
        expect(outcome).toBe('downloaded');
        expect(click).toHaveBeenCalledOnce();
    });

    it('uses the native share sheet when files are shareable', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'share', { value: share, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
        const outcome = await shareOrDownloadImage(new Blob(['x'], { type: 'image/png' }), 'card.png', { title: 'Card' });
        expect(outcome).toBe('shared');
        expect(share.mock.calls[0][0].files[0].name).toBe('card.png');
    });

    it('reports cancel without downloading', async () => {
        Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
        const { click } = stubDownload();
        expect(await shareOrDownloadImage(new Blob(['x']), 'card.png', { title: 'Card' })).toBe('cancelled');
        expect(click).not.toHaveBeenCalled();
    });

    it('falls back to download when sharing is denied', async () => {
        Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')), configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
        const { click } = stubDownload();
        expect(await shareOrDownloadImage(new Blob(['x']), 'card.png', { title: 'Card' })).toBe('downloaded');
        expect(click).toHaveBeenCalledOnce();
    });

    it('builds a Now what? hook card model', () => {
        const model = buildShareCardModel({
            kind: 'nowwhat',
            situation: 'You finished your first song.',
            answer: 'Document credits and ownership, then prepare your release.',
            url: 'https://indii.music/n/first-song',
        }, { brandColors: ['#FFB800', '#E65100'] });
        expect(model.eyebrow).toBe('Now what?');
        expect(model.title).toBe('You finished your first song. Now what?');
        expect(model.subtitle).toBe('Document credits and ownership, then prepare your release.');
        expect(model.callout).toBe('Take the free Artist Passport');
        expect(model.url).toBe('indii.music/n/first-song');
        expect(model.compactTitle).toBe(true);
    });

    it('builds fan-voice presave and founder seat card models', () => {
        const fan = buildShareCardModel({
            kind: 'presave',
            trackTitle: 'Midnight Echo',
            releaseDate: '2026-12-01',
            voice: 'fan',
        }, { now: new Date(2026, 10, 18) });
        expect(fan.eyebrow).toBe('Counting down');
        expect(fan.callout).toContain("I'm pre-saved");

        const founder = buildShareCardModel({
            kind: 'founder',
            name: 'Aria Sol',
            seat: 7,
            verificationHash: 'deadbeef12345678',
        });
        expect(founder.eyebrow).toBe('Founding Artist');
        expect(founder.title).toBe('Seat #007');
        expect(founder.subtitle).toBe('Aria Sol');
        expect(founder.callout).toBe('verified · deadbeef');
        expect(founder.accentFrom).toBe('#FFB800');
    });

    it('canShareFiles is false when canShare throws', () => {
        Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: () => { throw new Error('boom'); }, configurable: true });
        expect(canShareFiles(new File(['x'], 'a.png'))).toBe(false);
    });
});
