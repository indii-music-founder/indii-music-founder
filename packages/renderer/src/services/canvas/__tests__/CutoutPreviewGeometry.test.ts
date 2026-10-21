import { describe, expect, it } from 'vitest';
import { cutoutSourcePoint, cutoutZoomOffset } from '../CutoutPreviewGeometry';

describe('cutout preview geometry (pure coordinates)', () => {
    it('paints the same source pixel at fit and after zooming and scrolling', () => {
        const source = { width: 1024, height: 1024 };
        const pointer = { x: 228, y: 178 };
        expect(cutoutSourcePoint(pointer, { left: 100, top: 50, width: 256, height: 256 }, source)).toEqual({ x: 512, y: 512 });
        expect(cutoutSourcePoint(pointer, { left: -284, top: -334, width: 1024, height: 1024 }, source)).toEqual({ x: 512, y: 512 });
    });

    it('clamps a captured pointer that leaves the image to its source edges', () => {
        expect(cutoutSourcePoint({ x: -50, y: 500 }, { left: 100, top: 50, width: 256, height: 256 }, { width: 1024, height: 1024 })).toEqual({ x: 0, y: 1024 });
    });

    it('keeps the viewed center stable through zoom in and out', () => {
        const enlarged = cutoutZoomOffset(20, 248, 248, 1, 2);
        expect(enlarged).toBe(164);
        expect(cutoutZoomOffset(enlarged, 248, 248, 2, 1)).toBe(20);
    });

    it('accounts for the viewport becoming height-limited while zooming', () => {
        expect(cutoutZoomOffset(0, 255, 340, 1, 2)).toBe(85);
        expect(cutoutZoomOffset(85, 340, 255, 2, 1)).toBe(0);
        expect(cutoutZoomOffset(0, 340, 255, 4, 1)).toBe(0);
    });

    it('preserves the source center when scrollbars reduce the CSS content width', () => {
        // Measured production geometry: the nominal 4x image is 924px, not 984px.
        expect(cutoutZoomOffset(0, 246, 231, 246, 924)).toBe(346.5);
        expect(cutoutZoomOffset(346.5, 231, 246, 924, 246)).toBe(0);
    });

    it('preserves a scrolled detail when the scrollbar disappears during zoom out', () => {
        const offset = cutoutZoomOffset(420, 231, 246, 924, 492);
        expect((offset + 123) / 492).toBeCloseTo((420 + 115.5) / 924, 12);
    });
});
