import { describe, expect, it } from 'vitest';
import { artworkArtboardBounds, canvasStateDimensions, canvasViewportSize } from './canvasStateDimensions';

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

// Literal rectangle arithmetic, not persisted customer state.
describe('explicit artwork artboard bounds', () => {
    it('retains text above the base while trimming surrounding stage margins', () => {
        expect(artworkArtboardBounds([
            { left: 400, top: 300, width: 160, height: 220 },
            { left: 420, top: 250, width: 120, height: 25 },
        ])).toEqual({ left: 380, top: 230, width: 200, height: 310 });
    });
    it('includes offstage artwork rather than clipping it', () => {
        expect(artworkArtboardBounds([{ left: -35.3, top: -12.2, width: 80.5, height: 90.7 }]))
            .toEqual({ left: -56, top: -33, width: 122, height: 132 });
    });
    it('rejects empty, nonfinite, negative-size and oversized bounds', () => {
        expect(artworkArtboardBounds([])).toBeNull();
        expect(artworkArtboardBounds([{ left: NaN, top: 0, width: 10, height: 10 }])).toBeNull();
        expect(artworkArtboardBounds([{ left: 0, top: 0, width: -1, height: 10 }])).toBeNull();
        expect(artworkArtboardBounds([{ left: 0, top: 0, width: 20000, height: 10 }])).toBeNull();
    });
    it('is stable after translating all artwork by the returned origin', () => {
        const original = [{ left: 150, top: 100, width: 300, height: 400 }];
        const fitted = artworkArtboardBounds(original)!;
        const translated = original.map(box => ({ ...box, left: box.left - fitted.left, top: box.top - fitted.top }));
        expect(artworkArtboardBounds(translated)).toEqual({ left: 0, top: 0, width: fitted.width, height: fitted.height });
    });
});

describe('display-only viewport fit', () => {
    it('enlarges a small portrait without changing its logical pixel dimensions', () => {
        const logical = { width: 200, height: 300 };
        expect(canvasViewportSize(logical, { width: 800, height: 600 })).toEqual({ width: 400, height: 600 });
        expect(logical).toEqual({ width: 200, height: 300 });
    });
    it('shrinks a large wide artboard preserving its aspect ratio', () => {
        expect(canvasViewportSize({ width: 16384, height: 8192 }, { width: 800, height: 700 })).toEqual({ width: 800, height: 400 });
    });
    it('preserves fractional display sizing to avoid aspect distortion', () => {
        expect(canvasViewportSize({ width: 3, height: 2 }, { width: 100, height: 50 })).toEqual({ width: 75, height: 50 });
    });
    it.each([0, -1, NaN, Infinity])('rejects unusable viewport or artboard dimension %s', value => {
        expect(canvasViewportSize({ width: 200, height: 300 }, { width: value, height: 600 })).toBeNull();
        expect(canvasViewportSize({ width: value, height: 300 }, { width: 800, height: 600 })).toBeNull();
    });
});
