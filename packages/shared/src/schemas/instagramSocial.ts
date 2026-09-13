/**
 * indii-owned Instagram publishing and measurement policy.
 *
 * These are product guardrails, not claims about Meta's absolute provider
 * maximums. Keeping them in the shared package gives browser and Cloud
 * Functions callers one fail-closed contract.
 */
export const INSTAGRAM_POLICY_VERSION = '2026-09-13' as const;

export type InstagramSurface = 'feed' | 'carousel' | 'reel' | 'story' | 'live';
export type ReelAudienceIntent = 'discovery' | 'nurture';

export interface StorySegment {
    mediaUrl: string;
    durationSeconds: number;
    sequence: number;
}

export interface InstagramPublishingPayload {
    surface: InstagramSurface;
    width: number;
    height: number;
    caption: string;
    hashtags: string[];
    durationSeconds?: number;
    reelAudienceIntent?: ReelAudienceIntent;
    storyExtend?: boolean;
    storySegments?: StorySegment[];
}

export interface InstagramPolicyResult {
    valid: boolean;
    errors: string[];
    normalizedHashtags: string[];
    publishCaption: string;
    storyTtlHours?: 24 | 48;
}

const GENERIC_HASHTAGS = new Set([
    'explore', 'explorepage', 'fyp', 'foryou', 'foryoupage', 'instagood',
    'instagram', 'love', 'music', 'reels', 'trending', 'viral',
]);

const HASHTAG_PATTERN = /(^|\s)#[\p{L}\p{N}_]+/gu;

export function normalizeInstagramHashtags(hashtags: readonly string[]): string[] {
    const normalized = hashtags
        .map(tag => tag.trim().replace(/^#+/, '').toLocaleLowerCase())
        .filter(tag => /^[\p{L}\p{N}_]+$/u.test(tag));
    return [...new Set(normalized)];
}

export function formatInstagramCaption(caption: string, hashtags: readonly string[]): string {
    const body = caption.trim();
    const suffix = normalizeInstagramHashtags(hashtags).map(tag => `#${tag}`).join(' ');
    return [body, suffix].filter(Boolean).join('\n\n');
}

export function planStorySegments(durationSeconds: number): Array<{ sequence: number; startSeconds: number; durationSeconds: number }> {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
    const segments: Array<{ sequence: number; startSeconds: number; durationSeconds: number }> = [];
    for (let startSeconds = 0, sequence = 1; startSeconds < durationSeconds; startSeconds += 15, sequence += 1) {
        segments.push({
            sequence,
            startSeconds,
            durationSeconds: Math.min(15, durationSeconds - startSeconds),
        });
    }
    return segments;
}

function validateDimensions(payload: InstagramPublishingPayload, errors: string[]): void {
    const vertical = payload.surface === 'reel' || payload.surface === 'story' || payload.surface === 'live';
    const requiredWidth = 1080;
    const requiredHeight = vertical ? 1920 : 1350;
    if (payload.width !== requiredWidth || payload.height !== requiredHeight) {
        errors.push(`${payload.surface} media must be exactly ${requiredWidth}x${requiredHeight}px.`);
    }
}

function validateHashtags(payload: InstagramPublishingPayload, hashtags: string[], errors: string[]): void {
    if (hashtags.length !== payload.hashtags.length) {
        errors.push('Hashtags must be unique and contain only letters, numbers, or underscores.');
    }
    const [minimum, maximum] = payload.surface === 'reel' ? [5, 8] : [3, 5];
    if (payload.surface !== 'story' && payload.surface !== 'live' && (hashtags.length < minimum || hashtags.length > maximum)) {
        errors.push(`${payload.surface} requires ${minimum}-${maximum} specific hashtags.`);
    }
    const generic = hashtags.filter(tag => GENERIC_HASHTAGS.has(tag));
    if (generic.length > 0) errors.push(`Generic hashtags are not allowed: ${generic.map(tag => `#${tag}`).join(', ')}.`);
    if (payload.surface === 'reel' && HASHTAG_PATTERN.test(payload.caption)) {
        errors.push('Reel caption text must not contain hashtags; provide them separately so they are appended only at the end.');
    }
    HASHTAG_PATTERN.lastIndex = 0;
}

function validateDuration(payload: InstagramPublishingPayload, errors: string[]): void {
    const duration = payload.durationSeconds;
    if (payload.surface === 'reel') {
        if (!Number.isFinite(duration) || !payload.reelAudienceIntent) {
            errors.push('Reels require durationSeconds and reelAudienceIntent.');
        } else if (payload.reelAudienceIntent === 'discovery' && duration! >= 15) {
            errors.push('Discovery Reels must be under 15 seconds.');
        } else if (payload.reelAudienceIntent === 'nurture' && duration! <= 30) {
            errors.push('Nurture Reels must be over 30 seconds.');
        }
    }
    if (payload.surface === 'story' && Number.isFinite(duration) && duration! > 15) {
        const segments = [...(payload.storySegments ?? [])].sort((a, b) => a.sequence - b.sequence);
        const validSegments = segments.length > 1
            && segments.every((segment, index) => segment.sequence === index + 1
                && segment.mediaUrl.length > 0
                && segment.durationSeconds > 0
                && segment.durationSeconds <= 15)
            && Math.abs(segments.reduce((sum, segment) => sum + segment.durationSeconds, 0) - duration!) < 0.001;
        if (!validSegments) errors.push('Stories over 15 seconds require complete sequential media segments of at most 15 seconds each.');
    }
    if (payload.surface === 'live' && (!Number.isFinite(duration) || duration! <= 0 || duration! > 3600)) {
        errors.push('Live sessions must be greater than 0 and no longer than 60 minutes.');
    }
}

export function validateInstagramPublishingPayload(payload: InstagramPublishingPayload): InstagramPolicyResult {
    const errors: string[] = [];
    const normalizedHashtags = normalizeInstagramHashtags(payload.hashtags);
    validateDimensions(payload, errors);
    validateHashtags(payload, normalizedHashtags, errors);
    validateDuration(payload, errors);
    return {
        valid: errors.length === 0,
        errors,
        normalizedHashtags,
        publishCaption: formatInstagramCaption(payload.caption, normalizedHashtags),
        ...(payload.surface === 'story' ? { storyTtlHours: payload.storyExtend ? 48 : 24 } : {}),
    };
}

export type UnifiedViewsSource = 'views' | 'plays_legacy' | 'impressions_legacy' | 'unavailable';

export interface UnifiedViewsMetric {
    views: number | null;
    source: UnifiedViewsSource;
    label: string;
}

export function resolveUnifiedViews(metrics: { views?: number; plays?: number; impressions?: number }): UnifiedViewsMetric {
    if (Number.isFinite(metrics.views)) return { views: Math.max(0, metrics.views!), source: 'views', label: 'Views' };
    if (Number.isFinite(metrics.plays)) return { views: Math.max(0, metrics.plays!), source: 'plays_legacy', label: 'Views (provider plays)' };
    if (Number.isFinite(metrics.impressions)) return { views: Math.max(0, metrics.impressions!), source: 'impressions_legacy', label: 'Views unavailable; impressions proxy' };
    return { views: null, source: 'unavailable', label: 'Views unavailable' };
}

export function calculateReelEngagementPercent(metrics: { views: number | null; likes: number; shares: number; comments: number }): number | null {
    if (!metrics.views || metrics.views <= 0) return null;
    return ((metrics.likes + metrics.shares + metrics.comments) / metrics.views) * 100;
}

export type ReelShareSignal =
    | { value: number; kind: 'dm_shares'; label: 'DM shares' }
    | { value: number; kind: 'all_shares_proxy'; label: 'All shares (DM-share proxy)' }
    | { value: null; kind: 'unavailable'; label: 'DM shares unavailable' };

export function resolveReelShareSignal(metrics: { dmShares?: number; shares?: number }): ReelShareSignal {
    if (Number.isFinite(metrics.dmShares)) return { value: Math.max(0, metrics.dmShares!), kind: 'dm_shares', label: 'DM shares' };
    if (Number.isFinite(metrics.shares)) return { value: Math.max(0, metrics.shares!), kind: 'all_shares_proxy', label: 'All shares (DM-share proxy)' };
    return { value: null, kind: 'unavailable', label: 'DM shares unavailable' };
}

export interface NormalizedReelSignals {
    dmShareScore: number;
    viewsScore: number;
    retentionScore: number;
    engagementScore: number;
}

export function scoreReelDistribution(signals: NormalizedReelSignals): number {
    const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    return (
        clamp(signals.dmShareScore) * 0.45
        + clamp(signals.viewsScore) * 0.30
        + clamp(signals.retentionScore) * 0.15
        + clamp(signals.engagementScore) * 0.10
    ) * 100;
}

export function buildEngagementImagePrompt(subject: string): string {
    return `${subject.trim()}. Use one distinct central focal point, a natural human element such as a hand holding the subject, and restrained cool blue palette accents. Avoid clutter and text-heavy composition.`;
}
