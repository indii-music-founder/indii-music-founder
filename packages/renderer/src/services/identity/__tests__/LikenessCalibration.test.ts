import { describe, it, expect } from 'vitest';
import {
    evaluateLikenessCalibration,
    HUMAN_MODEL_PATH,
    FACE_LANDMARKER_MODEL_PATH
} from '../FacePipeline';
import {
    LikenessFusionService,
    IDENTITY_SIMILARITY_THRESHOLD
} from '../LikenessFusionService';
import {
    KNOWN_SAME_PAIRS,
    KNOWN_DIFFERENT_PAIRS,
    ALL_CALIBRATION_PAIRS,
    BASE_LANDMARKS_2D
} from '../__fixtures__/calibrationFixtures';

describe('Likeness Calibration Loop & Fixtures (Tool 1 / Likeness Locking)', () => {
    describe('Identity Mode Calibration (Biometric 128-d embeddings)', () => {
        it('evaluates 5 known-same pairs with high cosine similarity (> 0.90)', () => {
            const report = evaluateLikenessCalibration(KNOWN_SAME_PAIRS, 'identity');
            expect(report.sameScores).toHaveLength(5);
            expect(report.stats.sameMin).toBeGreaterThan(0.90);
            expect(report.stats.sameMax).toBeGreaterThanOrEqual(0.95);
            expect(report.stats.sameMean).toBeGreaterThan(0.93);
        });

        it('evaluates 5 known-different pairs with low cosine similarity (< 0.30)', () => {
            const report = evaluateLikenessCalibration(KNOWN_DIFFERENT_PAIRS, 'identity');
            expect(report.differentScores).toHaveLength(5);
            expect(report.stats.differentMax).toBeLessThan(0.30);
            expect(report.stats.differentMin).toBeGreaterThanOrEqual(0.05);
            expect(report.stats.differentMean).toBeLessThan(0.25);
        });

        it('full calibration suite exhibits rock-solid linear separability', () => {
            const report = evaluateLikenessCalibration(ALL_CALIBRATION_PAIRS, 'identity');
            expect(report.stats.sameCount).toBe(5);
            expect(report.stats.differentCount).toBe(5);
            expect(report.stats.isSeparable).toBe(true);

            // Separation margin = sameMin - differentMax
            expect(report.stats.separationMargin).toBeGreaterThan(0.60);

            // Default IDENTITY_SIMILARITY_THRESHOLD (0.55) must sit securely in the separation band
            expect(IDENTITY_SIMILARITY_THRESHOLD).toBeGreaterThan(report.stats.differentMax);
            expect(IDENTITY_SIMILARITY_THRESHOLD).toBeLessThan(report.stats.sameMin);

            // Recommended optimal threshold (midpoint) should be near 0.55 - 0.62
            expect(report.stats.recommendedThreshold).toBeGreaterThanOrEqual(0.55);
            expect(report.stats.recommendedThreshold).toBeLessThanOrEqual(0.65);
        });

        it('LikenessFusionService.calibrateLikenessLoop runs identically through the service facade', async () => {
            const report = await LikenessFusionService.calibrateLikenessLoop(ALL_CALIBRATION_PAIRS, 'identity');
            expect(report.mode).toBe('identity');
            expect(report.stats.isSeparable).toBe(true);
            expect(report.stats.sameCount).toBe(5);
            expect(report.stats.differentCount).toBe(5);
            expect(report.stats.sameMin).toBeGreaterThan(report.stats.differentMax);
        });
    });

    describe('Geometry Mode Calibration (Degraded A1.6 landmark alignment)', () => {
        it('evaluates 5 known-same pairs with high landmark alignment (> 0.95)', () => {
            const report = evaluateLikenessCalibration(KNOWN_SAME_PAIRS, 'geometry');
            expect(report.sameScores).toHaveLength(5);
            expect(report.stats.sameMin).toBeGreaterThan(0.95);
            expect(report.stats.sameMax).toBeCloseTo(1.0, 1);
        });

        it('evaluates 5 known-different pairs with low landmark alignment (< 0.60)', () => {
            const report = evaluateLikenessCalibration(KNOWN_DIFFERENT_PAIRS, 'geometry');
            expect(report.differentScores).toHaveLength(5);
            expect(report.stats.differentMax).toBeLessThan(0.60);
        });

        it('full geometry calibration produces a strictly positive separation margin', () => {
            const report = evaluateLikenessCalibration(ALL_CALIBRATION_PAIRS, 'geometry');
            expect(report.stats.isSeparable).toBe(true);
            expect(report.stats.separationMargin).toBeGreaterThan(0.35);
        });
    });

    describe('Calibration Edge Cases & Robustness', () => {
        it('throws an error when pairs array is empty', () => {
            expect(() => evaluateLikenessCalibration([])).toThrow(/at least one calibration pair is required/);
        });

        it('throws when identity mode pair lacks embeddings', () => {
            const badPair = [{
                id: 'bad_pair',
                isSameIdentity: true,
                a: { landmarks: BASE_LANDMARKS_2D },
                b: { landmarks: BASE_LANDMARKS_2D }
            }];
            expect(() => evaluateLikenessCalibration(badPair, 'identity')).toThrow(/missing embeddings/);
        });

        it('throws when geometry mode pair lacks landmarks', () => {
            const badPair = [{
                id: 'bad_pair',
                isSameIdentity: true,
                a: { embedding: [1, 2, 3] },
                b: { embedding: [1, 2, 3] }
            }];
            expect(() => evaluateLikenessCalibration(badPair, 'geometry')).toThrow(/missing landmarks/);
        });

        it('handles single-class calibration gracefully without crashing', () => {
            const reportSameOnly = evaluateLikenessCalibration(KNOWN_SAME_PAIRS, 'identity');
            expect(reportSameOnly.stats.sameCount).toBe(5);
            expect(reportSameOnly.stats.differentCount).toBe(0);
            expect(reportSameOnly.stats.separationMargin).toBe(0);
            expect(reportSameOnly.stats.isSeparable).toBe(false);
        });

        it('confirms vendored model path isolation (Ground Rule 8 / A1.1)', () => {
            // Must be local relative/root paths, strictly without remote origins (no http/https/cdn)
            expect(HUMAN_MODEL_PATH).toMatch(/^\/models\/human\/?$/);
            expect(HUMAN_MODEL_PATH).not.toMatch(/^https?:\/\//);
            expect(FACE_LANDMARKER_MODEL_PATH).toMatch(/^\/models\/face_landmarker\.task$/);
            expect(FACE_LANDMARKER_MODEL_PATH).not.toMatch(/^https?:\/\//);
        });
    });
});
