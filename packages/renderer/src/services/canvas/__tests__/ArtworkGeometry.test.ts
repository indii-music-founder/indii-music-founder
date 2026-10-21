import { describe, expect, it } from 'vitest';
import { artworkTransform, getViewportProxy, artworkAlphaBounds, artworkEnlargement, centeredArtworkPosition, alignedArtworkPosition, artworkExportDimensions } from '../ArtworkGeometry';
import { createDocFromImage, type RasterLayer } from '../CanvasDoc';

describe('cover geometry and legacy origins', () => {
    it('bounds export dimensions before an output surface can be allocated', () => {
        expect(artworkExportDimensions({ width: 3000, height: 3000 }, 2)).toEqual({ width: 6000, height: 6000 });
        expect(() => artworkExportDimensions({ width: 6000, height: 6000 }, 2)).toThrow(/36-megapixel/);
        for (const scale of [0, -1, NaN, Infinity, 0.00001]) {
            expect(() => artworkExportDimensions({ width: 3000, height: 3000 }, scale)).toThrow(/invalid/);
        }
        expect(() => artworkExportDimensions({ width: NaN, height: 3000 })).toThrow(/invalid/);
    });
    it('uses document coordinates at full size and derives a bounded preview', () => {
        expect(getViewportProxy(3000, 3000)).toEqual({ proxyWidth: 1024, proxyHeight: 1024, proxyScale: 1024 / 3000 });
        expect(getViewportProxy(800, 600)).toEqual({ proxyWidth: 800, proxyHeight: 600, proxyScale: 1 });
    });
    it('centers square fill without changing the original image dimensions', () => {
        const doc = createDocFromImage('fixture.png', 'unit-fixture'), photo = doc.layers[0] as RasterLayer;
        expect(artworkTransform(photo, 4000, 2000, doc)).toEqual({ x: -1500, y: 0, scaleX: 1.5, scaleY: 1.5, rotation: 0 });
        photo.framing = 'fit';
        expect(artworkTransform(photo, 4000, 2000, doc)).toEqual({ x: 0, y: 750, scaleX: 0.75, scaleY: 0.75, rotation: 0 });
    });
    it('centers rotated and reflected photos using their transformed center', () => {
        const center = centeredArtworkPosition(100, 80, 2, -1, 90, { width: 3000, height: 3000 });
        expect(center.x).toBeCloseTo(1460); expect(center.y).toBeCloseTo(1400);
        expect(centeredArtworkPosition(100, 80, 2, 1, 0, { width: 3000, height: 3000 })).toEqual({ x: 1400, y: 1460 });
    });
    it('measures visible alpha without counting RGB in transparent pixels or mutating the photo', () => {
        const width = 8, height = 6, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
        for (let i = 3; i < pixels.length; i += 4) pixels[i] = 0;
        pixels[(2 * width + 5) * 4 + 3] = 255;
        pixels[(4 * width + 6) * 4 + 3] = 1; // Include soft cutout edges.
        const original = pixels.slice();
        expect(artworkAlphaBounds(pixels, width, height)).toEqual({ x: 5, y: 2, width: 2, height: 3 });
        expect(pixels).toEqual(original);
        expect(artworkAlphaBounds(new Uint8ClampedArray(16).fill(255), 2, 2)).toEqual({ x: 0, y: 0, width: 2, height: 2 });
    });
    it('reports an empty cutout and rejects mismatched pixel dimensions', () => {
        expect(artworkAlphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
        expect(() => artworkAlphaBounds(new Uint8ClampedArray(16), 2, 3)).toThrow(/dimensions/);
        expect(() => artworkAlphaBounds(new Uint8ClampedArray(), 0, 0)).toThrow(/dimensions/);
    });

    it('centers the cutout bounds instead of the removed photo background', () => {
        const subject = { x: 700, y: 100, width: 100, height: 200 };
        const doc = { width: 3000, height: 3000 };
        const centered = centeredArtworkPosition(1000, 800, 2, 1, 0, doc, subject);
        expect(centered).toEqual({ x: 0, y: 1300 });
        const rotated = centeredArtworkPosition(1000, 800, -2, 1, 90, doc, subject);
        expect(rotated.x).toBeCloseTo(1700);
        expect(rotated.y).toBeCloseTo(3000);
    });

    it('aligns rotated and reflected bounds and preserves a center-anchored vertical placement', () => {
        const doc = createDocFromImage('literal.png', 'literal');
        const text = { ...doc.layers[0], framing: undefined, transformAnchor: 'center', x: 300, y: 400, scaleX: -2, scaleY: 1, rotation: 90 } as RasterLayer;
        const before = artworkTransform(text, 100, 80, doc);
        const left = alignedArtworkPosition(text, 100, 80, doc, 'left');
        expect(left.x).toBeCloseTo(80); expect(left.y).toBeCloseTo(before.y);
        const center = alignedArtworkPosition(text, 100, 80, doc, 'center');
        expect(center.x).toBeCloseTo(1540); expect(center.y).toBeCloseTo(before.y);
        const right = alignedArtworkPosition(text, 100, 80, doc, 'right');
        expect(right.x).toBeCloseTo(3000); expect(right.y).toBeCloseTo(before.y);
    });
    it('detects enlargement from framing, export scale and reflected placement', () => {
        const doc = createDocFromImage('literal.png', 'literal');
        const photo = doc.layers[0] as RasterLayer;
        expect(artworkEnlargement(photo, 4000, 2000, doc, 1)).toBe(1.5);
        photo.framing = 'fit';
        expect(artworkEnlargement(photo, 4000, 2000, doc, 1)).toBe(0.75);
        expect(artworkEnlargement(photo, 4000, 2000, doc, 2)).toBe(1.5);
        photo.framing = undefined; photo.scaleX = -2; photo.scaleY = 0.5;
        expect(artworkEnlargement(photo, 4000, 2000, doc, 1)).toBe(2);
    });
    it('converts legacy center coordinates to equivalent top-left rotation geometry', () => {
        const doc = createDocFromImage('fixture.png', 'unit-fixture');
        const photo = { ...doc.layers[0], framing: undefined, transformAnchor: 'center', x: 300, y: 400, scaleX: 2, scaleY: 1, rotation: 90 } as RasterLayer;
        const transform = artworkTransform(photo, 100, 80, doc);
        expect(transform.x).toBeCloseTo(340); expect(transform.y).toBeCloseTo(300);
        expect(transform.scaleX).toBe(2); expect(transform.rotation).toBe(90);
        photo.transformAnchor = 'top-left';
        expect(artworkTransform(photo, 100, 80, doc)).toMatchObject({ x: 300, y: 400 });
    });
});
