import { describe, expect, it } from 'vitest';
import { enhancedTilePixels } from '../enhancedTilePixels';

// Literal numeric packing checks only; no model/GPU/canvas/customer fixture.
// These checks do not establish successful enhancement or print acceptance.
describe('enhanced tile byte packing', () => {
    it('keeps RGB channel order, rounds bytes and supplies opaque tile alpha', () => {
        expect(Array.from(enhancedTilePixels([0, 127.4, 255, 10.6, 20.5, 30.1], 2, 1)))
            .toEqual([0, 127, 255, 255, 11, 21, 30, 255]);
    });
    it('rejects a channel count that does not match the dimensions', () => {
        expect(() => enhancedTilePixels([1, 2, 3, 4], 1, 1)).toThrow('RGB data');
    });
    it.each([0, -1, 1.5])('rejects invalid tile dimensions (%s)', width => {
        expect(() => enhancedTilePixels([], width, 1)).toThrow('tile dimensions');
    });
    it('rejects oversized tiles even when their RGB length is consistent', () => {
        expect(() => enhancedTilePixels(new Float32Array(609 * 3), 609, 1)).toThrow('tile dimensions');
    });
    it('accepts the supported tile boundary', () => {
        const bytes = enhancedTilePixels(new Float32Array(608 * 3), 608, 1);
        expect(bytes.length).toBe(608 * 4);
        expect(bytes[bytes.length - 1]).toBe(255);
    });
    it.each([NaN, Infinity, -1, 256])('rejects invalid model-output color values (%s)', value => {
        expect(() => enhancedTilePixels([value, 0, 0], 1, 1)).toThrow('color values');
    });
});
