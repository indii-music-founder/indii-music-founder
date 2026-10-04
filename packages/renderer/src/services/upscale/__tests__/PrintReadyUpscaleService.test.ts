import { describe, it, expect } from 'vitest';
import { planPrintUpscale, printUpscaleMethodLabel } from '../printUpscalePlan';

// Pure geometry checks only. No synthetic image, canvas, GPU, auth, or service
// response: these tests do not certify enhanced pixels or a customer export.
describe('print enhancement requirements', () => {
    it('requires the short edge to reach a square trim without stretching', () => {
        expect(planPrintUpscale(2048, 1024, 3000, 3000)).toEqual({ scale: 4, width: 8192, height: 4096 });
    });
    it('uses 2x for a reachable enlargement', () => {
        expect(planPrintUpscale(2048, 2048, 3000, 3000)).toEqual({ scale: 2, width: 4096, height: 4096 });
    });
    it('retains existing pixels when the crop has enough resolution', () => {
        expect(planPrintUpscale(4096, 4096, 3000, 3000).scale).toBe(1);
    });
    it('refuses an enlargement beyond the engine capability', () => {
        expect(() => planPrintUpscale(512, 512, 3000, 3000)).toThrow('more than a 4×');
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
