import { describe, it, expect } from 'vitest';
import { planPrintUpscale, printUpscaleMethodLabel } from '../printUpscalePlan';

// Pure geometry checks only. No synthetic image, canvas, GPU, auth, or service
// response: these tests do not certify enhanced pixels or a customer export.
describe('print enhancement requirements', () => {
    it('requires the short edge to reach a square trim without stretching', () => {
        expect(planPrintUpscale(2048, 1024, 3000, 3000)).toEqual({ scale: 4, passes: [4], width: 8192, height: 4096 });
    });
    it('uses 2x for a reachable enlargement', () => {
        expect(planPrintUpscale(2048, 2048, 3000, 3000)).toEqual({ scale: 2, passes: [2], width: 4096, height: 4096 });
    });
    it('retains existing pixels when the crop has enough resolution', () => {
        expect(planPrintUpscale(4096, 4096, 3000, 3000)).toEqual({ scale: 1, passes: [], width: 4096, height: 4096 });
    });
    it('chains a two-pass 4x -> 2x (8x) enlargement for 11x17 posters from standard 9:16 gallery assets (#418)', () => {
        expect(planPrintUpscale(768, 1344, 3300, 5100)).toEqual({
            scale: 8,
            passes: [4, 2],
            width: 6144,
            height: 10752,
        });
    });
    it('refuses an enlargement beyond the two-pass 8x engine capability', () => {
        expect(() => planPrintUpscale(256, 256, 3000, 3000)).toThrow('more than an 8×');
    });
    it.each([0, -1, 1.5, NaN, Infinity])('refuses invalid dimensions (%s)', value => {
        expect(() => planPrintUpscale(2048, 2048, value, 3000)).toThrow('positive whole pixels');
    });
    it('refuses an oversized output before canvas allocation', () => {
        expect(() => planPrintUpscale(5000, 5000, 10000, 10000)).toThrow('80 megapixel');
    });
    it('distinguishes browser enhancement from a resize of existing pixels', () => {
        expect(printUpscaleMethodLabel('browser-esrgan')).toBe('Browser AI');
        expect(printUpscaleMethodLabel('resize-only')).toBe('Source pixels (no AI enlargement)');
        expect(printUpscaleMethodLabel('desktop-realesrgan')).toBe('Desktop AI');
    });
});
