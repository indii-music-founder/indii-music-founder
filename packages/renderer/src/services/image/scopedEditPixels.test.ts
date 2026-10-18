import { describe, expect, it } from 'vitest';
import { applyMaskedPixels, maskContextCrop } from './scopedEditPixels';

describe('selected-area edit pixels', () => {
    it('retains every unmarked byte, including transparency and previous edits', () => {
        const source = new Uint8ClampedArray([20, 30, 40, 255, 70, 80, 90, 127, 1, 2, 3, 0]);
        const generated = new Uint8ClampedArray(12).fill(255);
        const mask = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 0]);
        expect([...applyMaskedPixels(source, generated, mask)]).toEqual([255, 255, 255, 255, 70, 80, 90, 127, 1, 2, 3, 0]);
        expect([...source]).toEqual([20, 30, 40, 255, 70, 80, 90, 127, 1, 2, 3, 0]);
    });
    it('blends an antialiased mask edge without changing the unmarked side', () => {
        expect([...applyMaskedPixels(new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([100, 200, 50, 255]), new Uint8ClampedArray([128, 128, 128, 255]))]).toEqual([50, 100, 25, 255]);
    });
    it('rejects mismatched output dimensions', () => {
        expect(() => applyMaskedPixels(new Uint8ClampedArray(4), new Uint8ClampedArray(8), new Uint8ClampedArray(4))).toThrow('dimensions');
    });
    it('rejects an empty mask instead of silently editing the whole image', () => {
        expect(() => maskContextCrop(new Uint8ClampedArray(4 * 400), 20, 20)).toThrow('Paint an area');
    });
    it('focuses a small marked area with context and clamps the crop inside the artboard', () => {
        const mask = new Uint8ClampedArray(200 * 180 * 4);
        mask.set([255, 255, 255, 255], (179 * 200 + 199) * 4);
        expect(maskContextCrop(mask, 200, 180)).toEqual({ left: 72, top: 52, size: 128 });
    });
    it('keeps the whole artboard for a selection wider than a square crop can hold', () => {
        const mask = new Uint8ClampedArray(200 * 50 * 4);
        mask.set([255, 255, 255, 255], 0);
        mask.set([255, 255, 255, 255], 199 * 4);
        expect(maskContextCrop(mask, 200, 50)).toEqual({ left: 0, top: 0, size: 0 });
    });
    it('does not treat a transparent white pixel as a selection', () => {
        expect(() => maskContextCrop(new Uint8ClampedArray([255, 255, 255, 0]), 1, 1)).toThrow('Paint an area');
    });
});
