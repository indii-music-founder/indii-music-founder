import { describe, it, expect } from 'vitest';
import {
    createDocFromImage,
    NEUTRAL_ADJUSTMENTS,
    mergeAdjustments,
    adjustmentsToFilters,
    vignetteMatrix,
    type RasterLayer
} from '../CanvasDoc';

describe('createDocFromImage (C1.1)', () => {
    it('creates a doc with a single neutral background raster layer', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        expect(doc.projectId).toBe('proj_1');
        expect(doc.layers).toHaveLength(1);
        const layer = doc.layers[0] as RasterLayer;
        expect(layer.kind).toBe('raster');
        expect(layer.src).toBe('data:image/png;base64,AAA');
        expect(layer.adjustments).toEqual(NEUTRAL_ADJUSTMENTS);
        expect(layer.visible).toBe(true);
        expect(layer.blendMode).toBe('normal');
    });

    it('throws when src/projectId are missing', () => {
        expect(() => createDocFromImage('', 'p')).toThrow(/src/);
        expect(() => createDocFromImage('x.png', '')).toThrow(/projectId/);
    });
});

describe('mergeAdjustments (immutability, C1.1)', () => {
    it('returns a new object and does not mutate the base', () => {
        const base = { ...NEUTRAL_ADJUSTMENTS };
        const merged = mergeAdjustments(base, { brightness: 0.5, hue: 40 });
        expect(merged).not.toBe(base);
        expect(merged.brightness).toBe(0.5);
        expect(merged.hue).toBe(40);
        expect(base.brightness).toBe(0); // untouched
    });
});

describe('adjustmentsToFilters (C1.2)', () => {
    it('maps a neutral stack to ZERO filters', () => {
        expect(adjustmentsToFilters(NEUTRAL_ADJUSTMENTS)).toEqual([]);
    });

    it('maps each non-neutral field to exactly one filter instance', () => {
        const filters = adjustmentsToFilters({
            brightness: 0.2, contrast: 0.3, saturation: 0.4, hue: 45,
            temperature: 0.5, exposure: -0.2, blur: 0.3, vignette: 0.4
        });
        const types = filters.map(f => f.type);
        expect(new Set(types).size).toBe(types.length); // no duplicates
        expect(types).toContain('Brightness');
        expect(types).toContain('Contrast');
        expect(types).toContain('Saturation');
        expect(types).toContain('HueRotation');
        expect(types).toContain('BlendColor'); // temperature
        expect(types).toContain('Gamma');      // exposure
        expect(types).toContain('Blur');
        expect(types).toContain('Convolute');  // vignette
        expect(filters).toHaveLength(8);
    });

    it('maps temperature to a warm/cool BlendColor, not hue', () => {
        const warm = adjustmentsToFilters({ ...NEUTRAL_ADJUSTMENTS, temperature: 0.6 });
        const cool = adjustmentsToFilters({ ...NEUTRAL_ADJUSTMENTS, temperature: -0.6 });
        expect(warm[0]).toMatchObject({ type: 'BlendColor', args: { color: '#ff9a4d' } });
        expect(cool[0]).toMatchObject({ type: 'BlendColor', args: { color: '#4da3ff' } });
        expect(warm[0]!.args.mode).toBe('softLight');
    });

    it('zero field maps to no filter; partial stack yields subset', () => {
        const onlyBrightness = adjustmentsToFilters({ ...NEUTRAL_ADJUSTMENTS, brightness: 0.3 });
        expect(onlyBrightness).toHaveLength(1);
        expect(onlyBrightness[0]!.type).toBe('Brightness');
    });
});

describe('vignetteMatrix', () => {
    it('produces a 9-element kernel that darkens with strength', () => {
        const weak = vignetteMatrix(0.1);
        const strong = vignetteMatrix(1);
        expect(weak).toHaveLength(9);
        expect(strong.every(v => v <= weak[0]!)).toBe(true);
    });
});
