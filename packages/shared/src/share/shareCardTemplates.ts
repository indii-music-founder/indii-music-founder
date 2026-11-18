/**
 * Share card templates — pure layout model.
 *
 * Turns domain data (a release, a presave campaign, a milestone) into the
 * text + palette a renderer draws. Kept free of DOM/canvas so it is fully
 * unit-testable and reusable by a future server-side OG renderer.
 */

export type ShareCardSize = 'story' | 'square' | 'og';

export const SHARE_CARD_DIMENSIONS: Record<ShareCardSize, { width: number; height: number; label: string }> = {
    story: { width: 1080, height: 1920, label: 'Story' },
    square: { width: 1080, height: 1080, label: 'Feed' },
    og: { width: 1200, height: 630, label: 'Link' },
};

/** DESIGN.md "Frequency" tokens — the indii signature palette. */
export const FREQUENCY_PALETTE = {
    void: '#030303',
    resonanceBlue: '#2E2EFE',
    frequencyPink: '#FE2E9A',
    dopaminePink: '#FF0099',
    electricBlue: '#00F0FF',
    signalWhite: '#F0F0F0',
} as const;

export type ShareCardTemplate =
    | {
        kind: 'presave';
        artistName?: string;
        trackTitle: string;
        /** YYYY-MM-DD, ISO string, or epoch milliseconds. */
        releaseDate: string | number;
        url?: string;
        coverArtUrl?: string;
        /** Artist campaign card vs fan-shared countdown card. */
        voice?: 'artist' | 'fan';
    }
    | {
        kind: 'release';
        artistName?: string;
        trackTitle: string;
        url?: string;
        coverArtUrl?: string;
    }
    | {
        kind: 'passport';
        artistName?: string;
        /** e.g. "STAGE 02" */
        stageBadge: string;
        stageTitle: string;
        /** Headline finding, e.g. the rights observation title. */
        finding: string;
        url?: string;
    }
    | {
        kind: 'artist';
        artistName: string;
        tagline?: string;
        url?: string;
    }
    | {
        kind: 'page';
        /** Short section label, e.g. "Pricing". */
        label: string;
        title: string;
        url?: string;
    }
    | {
        kind: 'nowwhat';
        /** Situation line before "Now what?", e.g. "You finished your first song." */
        situation: string;
        /** Actionable answer from indii. */
        answer: string;
        url?: string;
    }
    | {
        kind: 'founder';
        name: string;
        seat: number;
        joinedAt?: string;
        verificationHash: string;
    }
    | {
        kind: 'milestone';
        artistName?: string;
        headline: string;
        detail?: string;
    };

export interface ShareCardModel {
    eyebrow: string;
    title: string;
    subtitle?: string;
    callout?: string;
    url?: string;
    coverArtUrl?: string;
    accentFrom: string;
    accentTo: string;
    attribution: string;
    /** Smaller title with one extra line, for long headlines. */
    compactTitle?: boolean;
}

export interface ShareCardOptions {
    /** Artist brand colors (hex). First two valid colors become the gradient. */
    brandColors?: readonly string[];
    /** "made with indii" footer. On by default. */
    showAttribution?: boolean;
    /** Injected clock for deterministic countdowns in tests. */
    now?: Date;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_TITLE = 80;
const MAX_LINE = 120;
const DAY_MS = 86_400_000;

export const SHARE_ATTRIBUTION = 'made with indii · indii.music';

function clean(value: string | undefined, max: number): string {
    const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
    return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

/** Parses a YYYY-MM-DD (or ISO) date as a local calendar day. */
function parseReleaseDay(value: string | number): Date | null {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        const date = new Date(value);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dayOnly) {
        const [, y, m, d] = dayOnly;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** "Out in 12 days" / "Out tomorrow" / "Out today" / "Out now". */
export function describeCountdown(releaseDate: string | number, now: Date = new Date()): string | undefined {
    const release = parseReleaseDay(releaseDate);
    if (!release) return undefined;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((release.getTime() - today.getTime()) / DAY_MS);
    if (days > 1) return `Out in ${days} days`;
    if (days === 1) return 'Out tomorrow';
    if (days === 0) return 'Out today';
    return 'Out now';
}

function formatReleaseDay(releaseDate: string | number): string | undefined {
    const release = parseReleaseDay(releaseDate);
    if (!release) return undefined;
    return release.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Strips scheme + trailing slash so the printed link reads cleanly. */
export function displayUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
        return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
    } catch {
        return undefined;
    }
}

function safeCoverUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'blob:' || parsed.protocol === 'data:' ? url : undefined;
    } catch {
        return undefined;
    }
}

function pickAccents(brandColors: readonly string[] | undefined): { accentFrom: string; accentTo: string } {
    const valid = (brandColors ?? []).filter(color => HEX_COLOR.test(color));
    return {
        accentFrom: valid[0] ?? FREQUENCY_PALETTE.resonanceBlue,
        accentTo: valid[1] ?? FREQUENCY_PALETTE.frequencyPink,
    };
}

export function buildShareCardModel(template: ShareCardTemplate, options: ShareCardOptions = {}): ShareCardModel {
    const accents = pickAccents(options.brandColors);
    const attribution = options.showAttribution === false ? '' : SHARE_ATTRIBUTION;
    const artist = clean('artistName' in template ? template.artistName : undefined, MAX_LINE) || undefined;

    switch (template.kind) {
        case 'presave': {
            const countdown = describeCountdown(template.releaseDate, options.now);
            const day = formatReleaseDay(template.releaseDate);
            const isFan = template.voice === 'fan';
            const baseCallout = countdown && countdown !== 'Out now' && day ? `${countdown} · ${day}` : day;
            return {
                eyebrow: countdown === 'Out now' ? 'Out now' : isFan ? 'Counting down' : 'Pre-save now',
                title: clean(template.trackTitle, MAX_TITLE) || 'New music',
                subtitle: artist,
                callout: isFan
                    ? (baseCallout ? `I'm pre-saved · ${baseCallout}` : "I'm pre-saved")
                    : baseCallout,
                url: displayUrl(template.url),
                coverArtUrl: safeCoverUrl(template.coverArtUrl),
                attribution,
                ...accents,
            };
        }
        case 'release':
            return {
                eyebrow: 'Out now',
                title: clean(template.trackTitle, MAX_TITLE) || 'New music',
                subtitle: artist,
                callout: 'Stream it everywhere',
                url: displayUrl(template.url),
                coverArtUrl: safeCoverUrl(template.coverArtUrl),
                attribution,
                ...accents,
            };
        case 'passport':
            return {
                eyebrow: clean(`Artist Passport · ${template.stageBadge}`, 40),
                title: clean(template.stageTitle, MAX_TITLE) || 'Artist Passport',
                subtitle: artist,
                callout: clean(template.finding, MAX_LINE) || undefined,
                url: displayUrl(template.url),
                attribution,
                ...accents,
            };
        case 'artist':
            return {
                eyebrow: 'Independent artist',
                title: clean(template.artistName, MAX_TITLE) || 'Independent artist',
                callout: clean(template.tagline, MAX_LINE) || undefined,
                url: displayUrl(template.url),
                attribution,
                ...accents,
            };
        case 'page':
            return {
                eyebrow: clean(`indii.music · ${template.label}`, 40),
                title: clean(template.title, MAX_TITLE) || 'indii.music',
                compactTitle: true,
                url: displayUrl(template.url),
                attribution,
                ...accents,
            };
        case 'nowwhat':
            return {
                eyebrow: 'Now what?',
                title: clean(`${template.situation} Now what?`, MAX_TITLE) || 'Now what?',
                subtitle: clean(template.answer, MAX_LINE) || undefined,
                callout: 'Take the free Artist Passport',
                compactTitle: true,
                url: displayUrl(template.url),
                attribution,
                ...accents,
            };
        case 'founder': {
            const hasBrandOverride = (options.brandColors ?? []).some(color => HEX_COLOR.test(color));
            const founderAccents = hasBrandOverride
                ? accents
                : { accentFrom: '#FFB800', accentTo: '#E65100' };
            const seatLabel = Number.isFinite(template.seat)
                ? `Seat #${String(Math.max(0, Math.trunc(template.seat))).padStart(3, '0')}`
                : 'Founding Seat';
            const hashPrefix = (template.verificationHash ?? '').replace(/\s+/g, '').slice(0, 8);
            return {
                eyebrow: 'Founding Artist',
                title: seatLabel,
                subtitle: clean(template.name, MAX_LINE) || undefined,
                callout: hashPrefix ? `verified · ${hashPrefix}` : 'verified',
                attribution,
                ...founderAccents,
            };
        }
        case 'milestone':
            return {
                eyebrow: 'Milestone unlocked',
                title: clean(template.headline, MAX_TITLE) || 'Milestone',
                subtitle: artist,
                callout: clean(template.detail, MAX_LINE) || undefined,
                attribution,
                ...accents,
            };
    }
}

/** Filesystem-safe file name for the exported PNG. */
export function shareCardFileName(model: ShareCardModel, size: ShareCardSize): string {
    const slug = model.title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'indii';
    return `${slug}-${size}.png`;
}
