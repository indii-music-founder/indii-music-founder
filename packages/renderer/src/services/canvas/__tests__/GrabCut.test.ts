import { describe, expect, it } from 'vitest';
import { extractCutout } from '../segmentation/GrabCut';
import { ColorMixture } from '../segmentation/Gmm';

describe('guided cutout kernel', () => {
    it('separates a contrasting rectangle and honors keep/remove strokes at source resolution', () => {
        const width = 48, height = 48, pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4, inside = x >= 14 && x < 34 && y >= 10 && y < 38;
            pixels.set(inside ? [220, 35, 35, 255] : [30, 45, 210, 255], i);
        }
        pixels[(24 * width + 24) * 4 + 3] = 0;
        const mask = extractCutout({ width, height, pixels, rectangle: { x: 8, y: 6, width: 32, height: 36 }, strokes: [
            { label: 'remove', radius: 2, points: [{ x: 19.5, y: 24.5 }] },
            { label: 'keep', radius: 2, points: [{ x: 37.5, y: 25.5 }] },
        ] });
        expect(mask).toHaveLength(width * height);
        expect(mask[20 * width + 28]).toBe(255);
        expect(mask[3 * width + 3]).toBe(0);
        expect(mask[24 * width + 19]).toBe(0);
        expect(mask[25 * width + 37]).toBe(255);
        expect(mask[24 * width + 24]).toBe(0);
    });
    it('refines an unusually wide source without combining unrelated grid dimensions', () => {
        const width = 12000, height = 100, pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            pixels.set(x >= 5000 && x < 7000 && y >= 20 && y < 80 ? [220, 35, 35, 255] : [30, 45, 210, 255], (y * width + x) * 4);
        }
        const mask = extractCutout({ width, height, pixels, rectangle: { x: 4800, y: 10, width: 2400, height: 80 }, strokes: [] });
        expect(mask).toHaveLength(width * height);
        expect(mask[50 * width + 6000]).toBe(255);
        expect(mask[50 * width + 2000]).toBe(0);
    });
    it('fits flat and correlated RGB without singular covariance failures', () => {
        const samples = new Float32Array(Array.from({ length: 300 }, (_, i) => (Math.floor(i / 3) % 10) / 10));
        const model = ColorMixture.fit(samples);
        expect(Number.isFinite(model.logLikelihood(0.2, 0.2, 0.2))).toBe(true);
        expect(Number.isFinite(model.refit(samples).logLikelihood(0.3, 0.3, 0.3))).toBe(true);
        const flat = ColorMixture.fit(new Float32Array([1, 0, 0, 1, 0, 0]));
        expect(flat.logLikelihood(1, 0, 0)).toBeGreaterThan(flat.logLikelihood(0, 0, 1));
    });
    it('rejects invalid dimensions, empty rectangles and invalid brush input', () => {
        const input = { width: 4, height: 4, pixels: new Uint8ClampedArray(64), rectangle: { x: 0, y: 0, width: 1, height: 1 }, strokes: [] };
        expect(() => extractCutout(input)).toThrow(/box/);
        expect(() => extractCutout({ ...input, width: 10000 })).toThrow(/dimensions/);
    });
});
