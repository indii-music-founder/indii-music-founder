import { describe, expect, it } from 'vitest';
import { exportMultiplierFor, MAX_CANVAS_EXPORT_SIDE, nativeExportRegion } from './canvasUtils';

describe('exportMultiplierFor (ISSUE-1708)', () => {
    it('restores native resolution: a 3000px image shown at 0.2125 scale on a 1276px canvas exports ~3000px', () => {
        const scale = 638 / 3000; // artwork fitted into a 638px artboard
        const multiplier = exportMultiplierFor(scale, 718, 718);
        expect(Math.round(638 * multiplier)).toBeGreaterThanOrEqual(3000);
    });

    it('never goes below the old 2x for small or upscaled images', () => {
        expect(exportMultiplierFor(2, 800, 600)).toBe(2);
    });

    it('caps the longest side at the export limit', () => {
        const multiplier = exportMultiplierFor(0.01, 1000, 800);
        expect(Math.round(1000 * multiplier)).toBeLessThanOrEqual(MAX_CANVAS_EXPORT_SIDE);
    });

    it('falls back to 2x when the scale is unknown', () => {
        expect(exportMultiplierFor(0, 800, 600)).toBe(2);
        expect(exportMultiplierFor(Number.NaN, 800, 600)).toBe(2);
    });
});

describe('nativeExportRegion (ISSUE-1708 follow-up)', () => {
    // Production 2026-11-23: a 3000px artwork fitted into a 638px artboard with
    // 40px padding saved as 3201x3201 because the padding was exported too.
    const canvasSide = 638;
    const scale = (canvasSide - 40) / 3000;
    const shown = 3000 * scale;
    const offset = (canvasSide - shown) / 2;

    it('crops to the image so a 3000px artwork saves at exactly 3000px with no border', () => {
        const region = nativeExportRegion({ left: offset, top: offset, width: shown, height: shown }, scale, canvasSide, canvasSide);
        expect(region.left).toBeCloseTo(offset);
        expect(region.top).toBeCloseTo(offset);
        // A canvas element truncates fractional sizes, as the browser does.
        expect(Math.trunc(region.width * region.multiplier)).toBe(3000);
        expect(Math.trunc(region.height * region.multiplier)).toBe(3000);
    });

    it('keeps a non-square image at its native size', () => {
        const s = 500 / 4000;
        const region = nativeExportRegion({ left: 20, top: 69, width: 4000 * s, height: 2500 * s }, s, 540, 450);
        expect(Math.trunc(region.width * region.multiplier)).toBe(4000);
        expect(Math.trunc(region.height * region.multiplier)).toBe(2500);
    });

    it('clamps an image that overflows the artboard to the visible area', () => {
        const region = nativeExportRegion({ left: -50, top: -50, width: 800, height: 800 }, 0.5, 600, 600);
        expect(region).toMatchObject({ left: 0, top: 0, width: 600, height: 600 });
    });

    it('falls back to the whole artboard when the bounds are unusable', () => {
        const region = nativeExportRegion({ left: 0, top: 0, width: Number.NaN, height: 10 }, 0.5, 600, 400);
        expect(region).toMatchObject({ left: 0, top: 0, width: 600, height: 400 });
        expect(region.multiplier).toBe(exportMultiplierFor(0.5, 600, 400));
    });
});
