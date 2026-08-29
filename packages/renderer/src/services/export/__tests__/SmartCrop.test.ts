import { describe, it, expect } from 'vitest';
import {
    computeCrop,
    coverScale,
    isExtremeAspectChange,
    EXTREME_ASPECT_THRESHOLD,
    type CropAnchor
} from '../SmartCrop';

const faceCentered = (cx = 0.5, cy = 0.5, size = 0.2): CropAnchor[] => [
    { kind: 'face', box: { xmin: cx - size / 2, ymin: cy - size / 2, xmax: cx + size / 2, ymax: cy + size / 2 } }
];

describe('computeCrop — identity', () => {
    it('returns an identity crop for the same aspect ratio', () => {
        const r = computeCrop(1000, 1000, 3000, 3000);
        expect(r.x).toBe(0);
        expect(r.y).toBe(0);
        expect(r.scale).toBe(3);
    });

    it('returns an identity crop for matching non-square aspects', () => {
        const r = computeCrop(1600, 900, 1920, 1080);
        expect(r.x).toBe(0);
        expect(r.y).toBe(0);
        expect(r.scale).toBeCloseTo(1.2, 10);
    });

    it('throws on non-positive dimensions', () => {
        expect(() => computeCrop(0, 100, 100, 100)).toThrow();
        expect(() => computeCrop(100, 100, -5, 100)).toThrow();
    });
});

describe('computeCrop — square master → 9:16 (extreme change, cover)', () => {
    it('centers the crop when no anchors exist', () => {
        const r = computeCrop(3000, 3000, 1080, 1920);
        const winW = 1080 / r.scale; // 3000 * (1080/1920) = 1687.5
        expect(winW).toBeCloseTo(1687.5, 5); // crop window: full height, 1687.5px wide band
        expect(r.y).toBe(0);
        expect(r.x).toBeCloseTo((3000 - 1687.5) / 2, 5); // centered horizontally
    });

    it('keeps an off-center face centered with margin (G1.1)', () => {
        // Face at 25% from the left of a 3000×3000 master.
        const r = computeCrop(3000, 3000, 1080, 1920, faceCentered(0.25, 0.5));
        const winW = 1080 / r.scale; // 1687.5
        const facePx = 0.25 * 3000;  // 750
        // The face center must sit inside the crop window, not at its hard edge.
        const faceInWindow = facePx - r.x;
        expect(faceInWindow).toBeGreaterThan(0);
        expect(faceInWindow).toBeLessThan(winW);
        // Centered-with-margin: distance from window center ≤ margin band.
        const windowCenter = winW / 2;
        const margin = winW * 0.15;
        expect(Math.abs(faceInWindow - windowCenter)).toBeLessThanOrEqual(margin + 1e-6);
    });

    it('clamps the window to source bounds when the face is near the edge', () => {
        const r = computeCrop(3000, 3000, 1080, 1920, faceCentered(0.02, 0.5));
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + 1080 / r.scale).toBeLessThanOrEqual(3000 + 1e-6);
    });

    it('ignores malformed anchors and falls back to center crop', () => {
        const bad: CropAnchor[] = [
            { kind: 'face', box: { xmin: 0.8, ymin: 0.2, xmax: 0.2, ymax: 0.8 } } // inverted
        ];
        const r = computeCrop(3000, 3000, 1080, 1920, bad);
        expect(r.x).toBeCloseTo((3000 - 1687.5) / 2, 5);
    });
});

describe('computeCrop — landscape master → square', () => {
    it('centers vertically for a wider-than-tall target', () => {
        const r = computeCrop(1920, 1080, 1080, 1080);
        const winH = 1080 / r.scale;
        expect(winH).toBeCloseTo(1080, 5);
        expect(r.y).toBe(0);           // full height already
        expect(r.x).toBeCloseTo((1920 - 1080) / 2, 5); // centered horizontally
    });

    it('anchors a face vertically in a wide master', () => {
        // Face in the upper third of a 1920×1080 master, target square.
        const r = computeCrop(1920, 1080, 1080, 1080, faceCentered(0.5, 0.25));
        const winH = 1080 / r.scale;
        const facePxY = 0.25 * 1080; // 270
        const faceInWindow = facePxY - r.y;
        expect(faceInWindow).toBeGreaterThan(0);
        expect(faceInWindow).toBeLessThan(winH);
    });
});

describe('isExtremeAspectChange', () => {
    it('flags square → 9:16 as extreme (> 1.6×)', () => {
        expect(isExtremeAspectChange(3000, 3000, 1080, 1920)).toBe(true);
    });

    it('does not flag mild changes', () => {
        expect(isExtremeAspectChange(1600, 900, 1200, 630)).toBe(false);  // 1.778 vs 1.905 → 1.07×
        expect(isExtremeAspectChange(1440, 1080, 1920, 1080)).toBe(false); // 1.33 vs 1.78 → 1.33×
        expect(isExtremeAspectChange(1000, 1000, 1920, 1080)).toBe(true);  // 1.78× — square→16:9 is extreme
    });

    it('uses the shared threshold constant', () => {
        expect(EXTREME_ASPECT_THRESHOLD).toBe(1.6);
    });
});

describe('coverScale', () => {
    it('picks the larger ratio so the source fully covers the destination', () => {
        expect(coverScale(1000, 1000, 1080, 1920)).toBeCloseTo(1.92, 10);
        expect(coverScale(1920, 1080, 400, 400)).toBeCloseTo(400 / 1080, 10);
    });
});
