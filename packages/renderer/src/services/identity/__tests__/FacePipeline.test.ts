import { describe, it, expect } from 'vitest';
import { cosineSimilarity, geometryFitSimilarity, loadHuman, FACE_LANDMARKER_MODEL_PATH, HUMAN_MODEL_PATH } from '../FacePipeline';

describe('FacePipeline geometry similarity (A1.6 degraded)', () => {
    // 6 normalized face landmarks; indices 0/1 are the eye pair used for the
    // inter-ocular normalization in geometryFitSimilarity.
    const FACE_A: Array<[number, number]> = [
        [0.40, 0.40], [0.60, 0.40], [0.50, 0.55],
        [0.45, 0.70], [0.55, 0.70], [0.50, 0.20]
    ];

    it('identical landmarks → 1', () => {
        expect(geometryFitSimilarity(FACE_A, [...FACE_A])).toBeCloseTo(1, 6);
    });

    it('far-apart landmarks → near 0', () => {
        const far: Array<[number, number]> = FACE_A.map(p => [p[0] + 50, p[1] + 50] as [number, number]);
        expect(geometryFitSimilarity(FACE_A, far)).toBeLessThan(0.05);
    });

    it('is scale-invariant (same geometry scaled up stays ~1)', () => {
        const scaled: Array<[number, number]> = FACE_A.map(p => [p[0] * 2, p[1] * 2] as [number, number]);
        expect(geometryFitSimilarity(FACE_A, scaled)).toBeGreaterThan(0.9);
    });

    it('returns 0 for degenerate inputs', () => {
        expect(geometryFitSimilarity([[0, 0]], [[1, 1]])).toBe(0);
    });

    it('cosine anchors remain intact', () => {
        expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
        expect(() => cosineSimilarity([1, 2], [1])).toThrow(/dimension mismatch/);
    });

    it('identity backend is available (open-source @vladmandic/human)', () => {
        const human = loadHuman();
        expect(human.available).toBe(true);
        expect(human.mode).toBe('identity');
        expect(HUMAN_MODEL_PATH).toContain('models/human');
        expect(FACE_LANDMARKER_MODEL_PATH).toContain('face_landmarker.task');
    });
});
