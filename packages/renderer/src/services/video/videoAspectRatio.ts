import { judgeVideoAspectRatioIntent } from '@/config/typesafeJudgments';

export type SupportedVideoAspectRatio = '16:9' | '9:16';

function parseAspectRatio(input: string): number | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.includes(':')) {
        const [widthPart, heightPart] = trimmed.split(':');
        const width = Number(widthPart);
        const height = Number(heightPart);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return width / height;
        }
        return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function normalizeVideoAspectRatio(
    input: string | null | undefined
): { aspectRatio: SupportedVideoAspectRatio; coercedFrom?: string } {
    if (!input) {
        return { aspectRatio: '16:9' };
    }

    const ratio = parseAspectRatio(input);
    if (ratio === null) {
        const lower = input.toLowerCase();
        if (/\b(vertical|portrait|tiktok|reel|reels|short|shorts|story|stories|canvas|phone)\b/i.test(lower)) {
            return { aspectRatio: '9:16', coercedFrom: input };
        }
        if (/\b(horizontal|landscape|widescreen|wide|cinema|desktop|youtube|tv)\b/i.test(lower)) {
            return { aspectRatio: '16:9', coercedFrom: input };
        }
        return { aspectRatio: '16:9', coercedFrom: input };
    }

    const supported: Array<{ ratio: number; value: SupportedVideoAspectRatio }> = [
        { ratio: 16 / 9, value: '16:9' },
        { ratio: 9 / 16, value: '9:16' },
    ];

    const nearest = supported.reduce((best, candidate) => {
        const bestDistance = Math.abs(best.ratio - ratio);
        const candidateDistance = Math.abs(candidate.ratio - ratio);
        return candidateDistance < bestDistance ? candidate : best;
    });

    return {
        aspectRatio: nearest.value,
        ...(nearest.value === input ? {} : { coercedFrom: input }),
    };
}

/**
 * Semantically normalize aspect ratio from natural language instructions using Jev.
 * Falls back to deterministic heuristic and ratio math.
 */
export async function normalizeVideoAspectRatioAsync(
    input: string | null | undefined
): Promise<{ aspectRatio: SupportedVideoAspectRatio; coercedFrom?: string }> {
    if (!input) return { aspectRatio: '16:9' };
    const syncResult = normalizeVideoAspectRatio(input);
    if (syncResult.coercedFrom !== input) {
        return syncResult;
    }
    const judged = await judgeVideoAspectRatioIntent(input);
    if (judged) {
        return { aspectRatio: judged, coercedFrom: input };
    }
    return syncResult;
}
