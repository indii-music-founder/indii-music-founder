import { describe, expect, it } from 'vitest';
import { createDocFromImage, type RasterLayer } from '../CanvasDoc';
import { normalizeCanvasDoc } from '../CanvasDocValidation';
import { resizeArtworkDocument, artworkExportDimensions, getViewportProxy } from '../ArtworkGeometry';
import { ARTWORK_SOCIAL_SIZE, requireSocialArtworkSize } from '../ArtworkSocial';

describe('artwork social framing (pure document logic)', () => {
    it('uses the existing social feed preset', () => {
        expect(ARTWORK_SOCIAL_SIZE).toEqual({ width: 1080, height: 1350 });
        expect(() => requireSocialArtworkSize({ width: 3000, height: 3000 })).toThrow(/review the layout/);
        expect(() => requireSocialArtworkSize(ARTWORK_SOCIAL_SIZE)).not.toThrow();
    });
    it('preserves a manually positioned subject and its proportions in a portrait canvas', () => {
        const original = createDocFromImage('literal-source.png', 'pure-geometry');
        const layer = original.layers[0] as RasterLayer;
        layer.framing = undefined;
        layer.x = 1500; layer.y = 1500; layer.scaleX = 2; layer.scaleY = 2; layer.rotation = 15;
        layer.maskSrc = 'literal-mask.png';
        const result = resizeArtworkDocument(original, 1080, 1350);
        expect(result.layers[0]).toMatchObject({ x: 540, y: 675, scaleX: 0.9, scaleY: 0.9, rotation: 15, maskSrc: layer.maskSrc, src: layer.src });
        expect(original.width).toBe(3000);
        expect(original.layers[0]?.x).toBe(1500);
        expect(normalizeCanvasDoc(result)).toMatchObject({ width: 1080, height: 1350 });
        expect(artworkExportDimensions(result)).toEqual(ARTWORK_SOCIAL_SIZE);
        expect(getViewportProxy(result.width, result.height).proxyScale).toBe(1024 / 1350);
    });
    it.each([[0, 1080], [1080, NaN], [1080.5, 1350], [6001, 1080]])('rejects invalid dimensions %s × %s', (width, height) => {
        expect(() => resizeArtworkDocument(createDocFromImage('literal.png', 'pure-geometry'), width, height)).toThrow(/dimensions/);
    });
});
