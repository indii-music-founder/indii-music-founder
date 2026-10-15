import { describe, expect, it } from 'vitest';
import { canvasStateDimensions } from './canvasStateDimensions';

// Pure layout checks; no account, provider, or persisted product data is simulated.
describe('saved canvas dimensions', () => {
    it('keeps the 388 by 690 portrait artboard instead of the wider editor viewport', () => {
        expect(canvasStateDimensions({ width: 388, height: 690 })).toEqual({ width: 388, height: 690 });
    });
    it('prefers explicit dimensions when the artwork has been positioned off center', () => {
        expect(canvasStateDimensions({ width: 800, height: 600 }, { left: 10, top: 10, width: 360, height: 640 })).toEqual({ width: 800, height: 600 });
    });
    it('recovers a centered legacy portrait from its base image and margins', () => {
        expect(canvasStateDimensions({}, { left: 14, top: 25, width: 360, height: 640 })).toEqual({ width: 388, height: 690 });
    });
    it('rounds fractional bounding-box measurements to canvas pixels', () => {
        expect(canvasStateDimensions({}, { left: 14.1, top: 25.1, width: 360.1, height: 640.1 })).toEqual({ width: 388, height: 690 });
    });
    it.each([
        { width: 0, height: 690 }, { width: 388, height: -1 },
        { width: '388', height: 690 }, { width: Infinity, height: 690 },
        { width: 388, height: NaN }, { width: 20000, height: 690 },
    ])('rejects invalid dimensions $width by $height', state => {
        expect(canvasStateDimensions(state)).toBeNull();
    });
    it('does not infer dimensions from cropped or displaced base bounds', () => {
        expect(canvasStateDimensions({}, { left: -10, top: 25, width: 360, height: 640 })).toBeNull();
    });
    it('repairs a transient viewport snapshot when the complete portrait layout still fits', () => {
        const base = { left: 14, top: 25, width: 360, height: 640 };
        expect(canvasStateDimensions({ width: 1336, height: 690 }, base, [base, { left: 100, top: 180, width: 130, height: 24 }])).toEqual({ width: 388, height: 690 });
    });
    it('keeps the wide artboard if any content needs that space', () => {
        const base = { left: 14, top: 25, width: 360, height: 640 };
        expect(canvasStateDimensions({ width: 1336, height: 690 }, base, [base, { left: 600, top: 180, width: 130, height: 24 }])).toEqual({ width: 1336, height: 690 });
    });
    it('does not reinterpret a deliberately off-center base as a smaller artboard', () => {
        const base = { left: 10, top: 10, width: 360, height: 640 };
        expect(canvasStateDimensions({ width: 800, height: 600 }, base, [base])).toEqual({ width: 800, height: 600 });
    });
});
