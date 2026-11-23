import { describe, expect, it } from 'vitest';
import { exportMultiplierFor, MAX_CANVAS_EXPORT_SIDE } from './canvasUtils';

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
