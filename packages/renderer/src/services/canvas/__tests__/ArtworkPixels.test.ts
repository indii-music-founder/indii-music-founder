import { describe, expect, it } from 'vitest';
import { createDocFromImage, type RasterLayer } from '../CanvasDoc';
import { adjustArtworkPixels, finishArtworkPixels, effectiveAdjustments, applyArtworkMask } from '../ArtworkPixels';

const layer = () => createDocFromImage('pixel-fixture.png', 'unit-fixture').layers[0] as RasterLayer;
describe('artwork pixel contract', () => {
    it('preserves source transparency even after a legacy opaque filter', () => {
        const pixels = new Uint8ClampedArray([200, 140, 80, 255, 20, 30, 40, 255]);
        const mask = new Uint8ClampedArray([128, 128, 128, 255, 255, 255, 255, 255]);
        applyArtworkMask(pixels, mask, new Uint8Array([127, 0]));
        expect(Array.from(pixels)).toEqual([200, 140, 80, 64, 20, 30, 40, 0]);
    });
    it('preserves neutral RGB and every alpha value', () => {
        const pixels = new Uint8ClampedArray([0, 120, 255, 0, 42, 127, 230, 128]);
        const before = pixels.slice();
        adjustArtworkPixels(pixels, layer());
        expect(pixels).toEqual(before);
    });
    it('applies exposure in linear light, preserving fractional alpha', () => {
        const photo = layer(); photo.adjustments.exposure = 1;
        const pixels = new Uint8ClampedArray([128, 128, 128, 127]);
        adjustArtworkPixels(pixels, photo);
        expect(Array.from(pixels)).toEqual([176, 176, 176, 127]);
    });
    it('desaturates at -1 and softens contrast at negative values', () => {
        const photo = layer(); photo.adjustments.saturation = -1;
        const pixels = new Uint8ClampedArray([240, 100, 40, 255]);
        adjustArtworkPixels(pixels, photo);
        expect(pixels[0]).toBe(pixels[1]); expect(pixels[1]).toBe(pixels[2]);
        photo.adjustments.saturation = 0; photo.adjustments.contrast = -0.5;
        const contrast = new Uint8ClampedArray([240, 100, 40, 255]);
        adjustArtworkPixels(contrast, photo);
        expect(contrast[0]).toBeLessThan(240); expect(contrast[2]).toBeGreaterThan(40);
    });
    it('makes temperature continuous and preset strength zero an identity contribution', () => {
        const photo = layer(); photo.adjustments.temperature = 0.1;
        const weak = new Uint8ClampedArray([128, 128, 128, 255]); adjustArtworkPixels(weak, photo);
        photo.adjustments.temperature = 0.9;
        const strong = new Uint8ClampedArray([128, 128, 128, 255]); adjustArtworkPixels(strong, photo);
        expect(strong[0]! - 128).toBeGreaterThan(weak[0]! - 128);
        photo.look = { id: 'warm-film', strength: 0, version: 1 };
        expect(effectiveAdjustments(photo)).toEqual(photo.adjustments);
        photo.look.strength = 1;
        expect(effectiveAdjustments(photo).exposure).toBeCloseTo(0.15);
        expect(photo.adjustments.exposure).toBe(0);
    });
    it('darkens edges radially and repeats seeded grain without altering alpha', () => {
        const photo = layer(); photo.adjustments.vignette = 1;
        const pixels = new Uint8ClampedArray(9 * 9 * 4).fill(200);
        finishArtworkPixels(pixels, 9, 9, photo);
        expect(pixels[0]).toBeLessThan(pixels[(4 * 9 + 4) * 4]!);
        expect(pixels[3]).toBe(200);
        photo.grain = { amount: 0.8, seed: 8192 };
        const first = new Uint8ClampedArray(9 * 9 * 4).fill(128), second = first.slice();
        finishArtworkPixels(first, 9, 9, photo); finishArtworkPixels(second, 9, 9, photo);
        expect(first).toEqual(second);
        expect(first[3]).toBe(128);
        expect(new Set(first.filter((_, index) => index % 4 === 0)).size).toBeGreaterThan(1);
    });
});
