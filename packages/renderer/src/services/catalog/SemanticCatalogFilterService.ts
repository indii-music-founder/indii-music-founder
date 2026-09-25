import {
    judgeSemanticCatalogFilter,
    type TrackSearchItem,
} from '@/config/typesafeJudgments';

/**
 * Deterministic client-side catalog filter (fallback):
 * Matches search terms across title, genre, and mood tags.
 */
export function filterCatalogDeterministic(
    query: string,
    items: TrackSearchItem[]
): TrackSearchItem[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    return items.filter((item) => {
        const textToSearch = `${item.title} ${item.genre} ${(item.moodTags || []).join(' ')}`.toLowerCase();
        return tokens.every((token) => textToSearch.includes(token));
    });
}

/**
 * Filter catalog items using fast Jev semantic classification.
 * Falls back immediately to the deterministic token matcher if Jev is unavailable,
 * times out, or returns empty.
 */
export async function filterCatalogSemantically(
    query: string,
    items: TrackSearchItem[]
): Promise<TrackSearchItem[]> {
    const trimmed = query.trim();
    if (!trimmed || items.length === 0) return items;

    try {
        const matchedIds = await judgeSemanticCatalogFilter(trimmed, items);
        if (matchedIds && matchedIds.length > 0) {
            const idSet = new Set(matchedIds);
            const filtered = items.filter((item) => idSet.has(item.id));
            if (filtered.length > 0) return filtered;
        }
    } catch {
        // Fall through to deterministic filter
    }

    return filterCatalogDeterministic(query, items);
}
