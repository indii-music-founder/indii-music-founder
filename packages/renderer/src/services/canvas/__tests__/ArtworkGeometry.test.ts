import { describe, expect, it } from 'vitest';
import { artworkTransform, getViewportProxy, artworkEnlargement, centeredArtworkPosition, alignedArtworkPosition, artworkExportDimensions } from '../ArtworkGeometry';
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
