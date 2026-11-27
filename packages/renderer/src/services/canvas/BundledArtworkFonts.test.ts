import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { BUNDLED_ARTWORK_FONTS, buildBundledArtworkFontArchive } from '@/services/canvas/BundledArtworkFonts';

describe('bundled artwork font downloads', () => {
    it.each(BUNDLED_ARTWORK_FONTS)('exports $family with its WOFF2 and OFL text', async font => {
        const result = await buildBundledArtworkFontArchive(font);
        const zip = await JSZip.loadAsync(result.bytes);
        const fileStem = `${font.family.replaceAll(' ', '-')}-${font.style}`;
        const fontBytes = await zip.file(`${fileStem}.woff2`)?.async('uint8array');

        expect(result.filename).toBe(`${fileStem}.zip`);
        expect(Array.from(fontBytes?.slice(0, 4) ?? [])).toEqual([119, 79, 70, 50]);
        expect(await zip.file('OFL.txt')?.async('string')).toContain('SIL OPEN FONT LICENSE');
    });
});
