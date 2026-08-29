import { describe, expect, it } from 'vitest';
import {
    deltaE2000,
    hexToRgb,
    quantizeRgbPixels,
    rgbToHex,
    srgbToLab,
} from './ColorExtraction';

/**
 * Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference
 * Formula: Implementation Notes..." — the canonical CIEDE2000 test vectors.
 */
const SHARMA_PAIRS: Array<{
    lab1: [number, number, number];
    lab2: [number, number, number];
    expected: number;
}> = [
    { lab1: [50, 2.5, 0], lab2: [73, 25, -18], expected: 27.1492 },
    { lab1: [50, 2.5, 0], lab2: [61, -5, 29], expected: 22.8977 },
    { lab1: [50, 2.5, 0], lab2: [56, -27, -3], expected: 31.903 },
    { lab1: [50, 2.5, 0], lab2: [58, 24, 15], expected: 19.4535 },
    { lab1: [50, 2.5, 0], lab2: [50, 3.1736, 0.5854], expected: 1.0 },
    { lab1: [50, 2.5, 0], lab2: [50, 3.2972, 0], expected: 1.0 },
    { lab1: [50, 2.5, 0], lab2: [50, 1.8634, 0.5757], expected: 1.0 },
    { lab1: [50, 2.5, 0], lab2: [50, 3.2592, 0.335], expected: 1.0 },
    { lab1: [50, 2.6772, -79.7751], lab2: [50, 0, -82.7485], expected: 2.0425 },
    { lab1: [50, -1.3802, -84.2814], lab2: [50, 0, -82.7485], expected: 1.0 },
    { lab1: [90.8027, -2.0831, 1.441], lab2: [91.1528, -1.6435, 0.0447], expected: 1.4441 },
    { lab1: [2.0776, 0.0795, -1.135], lab2: [0.9033, -0.0636, -0.5514], expected: 0.9082 },
];

describe('deltaE2000', () => {
    it.each(SHARMA_PAIRS)('matches CIEDE2000 reference $expected', ({ lab1, lab2, expected }) => {
        expect(deltaE2000(lab1, lab2)).toBeCloseTo(expected, 3);
    });

    it('is zero for identical colors', () => {
        expect(deltaE2000([50, 2.5, 0], [50, 2.5, 0])).toBe(0);
    });

    it('is symmetric', () => {
        const a: [number, number, number] = [50, 2.5, 0];
        const b: [number, number, number] = [73, 25, -18];
        expect(deltaE2000(a, b)).toBe(deltaE2000(b, a));
    });

    it('scores clearly different colors far above the brand tolerance', () => {
        const red = srgbToLab('#FF0000');
        const blue = srgbToLab('#0000FF');
        expect(deltaE2000(red, blue)).toBeGreaterThan(12);
    });
});

describe('srgbToLab', () => {
    it('converts sRGB red to the canonical Lab value', () => {
        const [L, a, b] = srgbToLab('#FF0000');
        expect(L).toBeCloseTo(53.24, 1);
        expect(a).toBeCloseTo(80.09, 1);
        expect(b).toBeCloseTo(67.2, 1);
    });

    it('maps black to L=0 and white to L=100', () => {
        expect(srgbToLab('#000000')[0]).toBeCloseTo(0, 1);
        expect(srgbToLab('#FFFFFF')[0]).toBeCloseTo(100, 1);
    });

    it('throws on invalid hex', () => {
        expect(() => srgbToLab('not-a-color')).toThrow();
        expect(() => srgbToLab('#12345')).toThrow();
    });
});

describe('hex/rgb round-trip', () => {
    it('round-trips hex through rgb and back', () => {
        expect(rgbToHex(...hexToRgb('#A1B2C3'))).toBe('#a1b2c3');
        expect(rgbToHex(...hexToRgb('#F0A'))).toBe('#ff00aa');
    });
});

function rgbaBytes(pixels: Array<[number, number, number, number]>): Uint8Array {
    const out = new Uint8Array(pixels.length * 4);
    pixels.forEach((px, i) => {
        out[i * 4] = px[0];
        out[i * 4 + 1] = px[1];
        out[i * 4 + 2] = px[2];
        out[i * 4 + 3] = px[3];
    });
    return out;
}

describe('quantizeRgbPixels (median cut)', () => {
    const RED: [number, number, number, number] = [255, 0, 0, 255];
    const BLUE: [number, number, number, number] = [0, 0, 255, 255];

    it('splits a two-tone image into exactly two 50/50 clusters', () => {
        const pixels = rgbaBytes([RED, RED, RED, RED, BLUE, BLUE, BLUE, BLUE]);
        const clusters = quantizeRgbPixels(pixels, 6);
        expect(clusters).toHaveLength(2);
        const hexes = clusters.map((c) => c.hex).sort();
        expect(hexes).toEqual(['#0000ff', '#ff0000']);
        expect(clusters[0]!.coverage).toBeCloseTo(0.5, 5);
        expect(clusters[1]!.coverage).toBeCloseTo(0.5, 5);
    });

    it('is deterministic across repeated calls', () => {
        const pixels = rgbaBytes([RED, BLUE, RED, BLUE, [10, 200, 30, 255], [12, 198, 28, 255]]);
        expect(quantizeRgbPixels(pixels, 6)).toEqual(quantizeRgbPixels(pixels, 6));
    });

    it('skips transparent pixels', () => {
        const pixels = rgbaBytes([RED, [0, 0, 0, 0], [0, 0, 0, 100], RED]);
        const clusters = quantizeRgbPixels(pixels, 6);
        expect(clusters).toHaveLength(1);
        expect(clusters[0]!.coverage).toBe(1);
        expect(clusters[0]!.hex).toBe('#ff0000');
    });

    it('collapses a single-color image to one cluster', () => {
        const pixels = rgbaBytes([RED, RED, RED]);
        const clusters = quantizeRgbPixels(pixels, 6);
        expect(clusters).toHaveLength(1);
        expect(clusters[0]!.hex).toBe('#ff0000');
        expect(clusters[0]!.coverage).toBe(1);
    });

    it('returns an empty list for fully transparent input', () => {
        expect(quantizeRgbPixels(rgbaBytes([[0, 0, 0, 0]]), 6)).toEqual([]);
    });
});

// NOTE: `extractDominantColors` (the canvas-backed wrapper) has no jsdom test on
// purpose — jsdom's Image never fires onload/onerror for data URLs, so any test
// would either hang or fake the loader. Its behavioral proof is the D2.3
// founder-kit real smoke (see docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md).
