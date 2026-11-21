import { describe, it, expect } from 'vitest';
import { buildGalleryManifestEntries, latestGeneratedItem } from './galleryAssets';

// Newest first, exactly as creativeHistorySlice stores it.
const history = Array.from({ length: 25 }, (_, i) => ({ id: `asset-${24 - i}`, type: 'image', prompt: `prompt ${24 - i}` }));

describe('gallery asset ordering (ISSUE-1663)', () => {
    it('lists the newest assets with aliases that resolve to the same item', () => {
        const entries = buildGalleryManifestEntries(history);
        expect(entries).toHaveLength(20);
        expect(entries[0]).toEqual({ alias: 'gallery-0', type: 'image', name: 'prompt 24' });
        expect(entries.map(entry => entry.name)).not.toContain('prompt 0');
        entries.forEach((entry, index) => expect(history[index]!.prompt).toBe(entry.name));
    });

    it('treats the first item as the latest generation', () => {
        expect(latestGeneratedItem(history)?.id).toBe('asset-24');
        expect(latestGeneratedItem([])).toBeUndefined();
    });
});
