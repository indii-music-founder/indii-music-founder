/**
 * `generatedHistory` is newest-first (creativeHistorySlice prepends, load sorts
 * descending), and the `gallery-N` alias resolves to `generatedHistory[N]`
 * (tools/CommerceTools.ts). Taking the tail of the list showed agents the
 * oldest assets and auto-attached the oldest image as "latest" (ISSUE-1663).
 */
export const GALLERY_MANIFEST_LIMIT = 20;

interface GalleryItem {
    id: string;
    type?: string;
    prompt?: string;
}

export function buildGalleryManifestEntries<T extends GalleryItem>(
    history: readonly T[] | undefined,
    limit = GALLERY_MANIFEST_LIMIT,
): Array<{ alias: string; type: T['type']; name: string }> {
    return (history ?? []).slice(0, limit).map((asset, index) => ({
        alias: `gallery-${index}`,
        type: asset.type,
        name: (asset.prompt || asset.id).slice(0, 200),
    }));
}

export function latestGeneratedItem<T>(history: readonly T[] | undefined): T | undefined {
    return history?.[0];
}
