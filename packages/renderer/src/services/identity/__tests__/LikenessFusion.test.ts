import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../FacePipeline';
import {
    LikenessFusionService,
    IDENTITY_SIMILARITY_THRESHOLD,
    LIKENESS_IDENTITY_PROMPT_SUFFIX,
    type FusionAttempt
} from '../LikenessFusionService';
import { APPROVED_MODELS } from '@/core/config/intelligence-models';

describe('cosineSimilarity (A1.2)', () => {
    it('identical vectors → 1', () => {
        expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    });
    it('orthogonal vectors → 0', () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
    });
    it('inverted vectors → -1', () => {
        expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
    });
    it('dimension mismatch throws', () => {
        expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
    });
    it('non-empty and zero-magnitude guards', () => {
        expect(() => cosineSimilarity([], [])).toThrow(/non-empty/);
        expect(() => cosineSimilarity([0, 0], [1, 1])).toThrow(/zero-magnitude/);
    });
});

// ---------------------------------------------------------------------------
// A1.3 — fuseLikeness with a MOCKED pipeline (per plan, mock-based loop test;
// the real threshold calibration is A1.5, explicitly not mockable).
// ---------------------------------------------------------------------------

const makeEmbedding = (value: number) => [value, value, value];

function makeDeps(opts: {
    headshot?: 'ok' | 'no-face' | 'none';
    attemptSimilarities?: number[];
    editUrl?: (i: number) => string;
} = {}) {
    const headshot: 'ok' | 'no-face' | 'none' = opts.headshot ?? 'ok';
    const attemptSimilarities = opts.attemptSimilarities ?? [0.9];
    let i = 0;

    return {
        analyzeFace: async (url: string) => {
            return url.startsWith('data:image/headshot')
                ? headshot === 'no-face'
                    ? { faces: [], primaryEmbedding: null }
                    : { faces: [{ box: { x: 0, y: 0, width: 10, height: 10 }, score: 0.9 }], primaryEmbedding: makeEmbedding(0.9) }
                : { faces: [{ box: { x: 0, y: 0, width: 10, height: 10 }, score: 0.9 }], primaryEmbedding: makeEmbedding(attemptSimilarities[Math.min(i, attemptSimilarities.length - 1)]!) };
        },
        resolveHeadshot: async () => {
            if (headshot === 'none') throw new Error('No verified likeness found. Add a selfie in My Likeness before fusing (DEC-2).');
            return { id: 'img_4488', url: 'data:image/headshot;base64,QUJD', storageRef: 'likeness/img_4488.webp', createdAt: 1, qualityScore: 'good' as const };
        },
        similarity: (a: number[], b: number[]) => {
            const sim = b[0]!;
            i++;
            return sim;
        },
        geometrySimilarity: (_a: Array<[number, number]>, _b: Array<[number, number]>) => 0.9,
        edit: async (args: { image: { mimeType: string; data: string }; prompt: string; model: string; sourceImages: Array<{ mimeType: string; data: string }> }) => {
            expect(args.model).toBe(APPROVED_MODELS.IMAGE_GEN); // Ground Rule 6
            expect(args.prompt).toContain(LIKENESS_IDENTITY_PROMPT_SUFFIX);
            expect(args.sourceImages.length).toBeGreaterThan(0);
            return { id: `r${i}`, url: (opts.editUrl ? opts.editUrl(i) : `data:image/result;base64,${i}`) };
        },
        threshold: opts.headshot === 'ok' || !opts.headshot ? IDENTITY_SIMILARITY_THRESHOLD : IDENTITY_SIMILARITY_THRESHOLD
    };
}

const TARGET = 'data:image/png;base64,TARGET';
const attemptListToSimilarities = (attempts: FusionAttempt[]) => attempts.map(a => a.similarity);

describe('fuseLikeness loop (A1.3)', () => {
    it('rejects when no verified likeness exists (DEC-2)', async () => {
        await expect(LikenessFusionService.fuseLikeness({ targetDataUrl: TARGET }, makeDeps({ headshot: 'none' })))
            .rejects.toThrow(/No verified likeness/);
    });

    it('rejects an unreadable / no-face headshot', async () => {
        await expect(LikenessFusionService.fuseLikeness({ targetDataUrl: TARGET }, makeDeps({ headshot: 'no-face' })))
            .rejects.toThrow(/could not be read as a face/);
    });

    it('retries below the threshold and returns the best-of-N', async () => {
        // attempt1 sim 0.40 (fail), attempt2 sim 0.72 (pass)
        const result = await LikenessFusionService.fuseLikeness(
            { targetDataUrl: TARGET, maxAttempts: 3 },
            makeDeps({ attemptSimilarities: [0.40, 0.72], editUrl: () => 'data:image/result;base64,R' })
        );
        expect(result.attempts).toHaveLength(2);
        expect(attemptListToSimilarities(result.attempts)).toEqual([0.40, 0.72]);
        expect(result.similarity).toBeCloseTo(0.72, 10);
        expect(result.passedThreshold).toBe(true);
        expect(result.dataUrl).toBe('data:image/result;base64,R');
    });

    it('exhausts maxAttempts and reports not-passed with the best attempt', async () => {
        const result = await LikenessFusionService.fuseLikeness(
            { targetDataUrl: TARGET, maxAttempts: 3 },
            makeDeps({ attemptSimilarities: [0.30, 0.44, 0.51], editUrl: (i) => `data:image/r${i}` })
        );
        expect(result.attempts).toHaveLength(3);
        expect(result.similarity).toBeCloseTo(0.51, 10);
        expect(result.passedThreshold).toBe(false);
        expect(result.dataUrl).toBe('data:image/r2');
    });

    it('returns the single best attempt on first-pass and short-circuits', async () => {
        const result = await LikenessFusionService.fuseLikeness(
            { targetDataUrl: TARGET, maxAttempts: 5 },
            makeDeps({ attemptSimilarities: [0.90], editUrl: () => 'data:image/win' })
        );
        expect(result.attempts).toHaveLength(1);
        expect(result.passedThreshold).toBe(true);
        expect(result.similarity).toBeCloseTo(0.90, 10);
    });
});

// ---------------------------------------------------------------------------
// degraded geometry mode (founder-approved A1.6): geometry-fit, not identity
// ---------------------------------------------------------------------------

describe('fuseLikeness in degraded geometry mode (A1.6)', () => {
    function geomDeps(attemptGeo: number[]) {
        let i = 0;
        const L = [[33,100],[263,100],[100,80],[120,60]] as Array<[number, number]>;
        return {
            analyzeFace: async () => ({
                faces: [{ box: { x: 0, y: 0, width: 10, height: 10 }, score: 1 }],
                primaryEmbedding: null,
                landmarks: L,
                embeddingMode: 'geometry' as const
            }),
            resolveHeadshot: async () => ({ id: 'img_4488', url: 'data:image/headshot;base64,QUJD', storageRef: 'x', createdAt: 1, qualityScore: 'good' as const }),
            similarity: (_a, _b) => 999, // must NOT be called in geometry mode
            geometrySimilarity: (_a, _b) => { const v = attemptGeo[Math.min(i, attemptGeo.length - 1)]!; i++; return v; },
            edit: async () => ({ id: 'r', url: 'data:image/result;base64,R' }),
            threshold: 0.55
        };
    }

    it('scores geometry fit (not cosine) and reports embeddingMode geometry', async () => {
        const result = await LikenessFusionService.fuseLikeness(
            { targetDataUrl: TARGET, maxAttempts: 2 },
            geomDeps([0.70])
        );
        expect(result.embeddingMode).toBe('geometry');
        expect(result.similarity).toBeCloseTo(0.70, 10);
        expect(result.passedThreshold).toBe(true);
    });

    it('retries below the geometry threshold and returns best-of-N', async () => {
        const result = await LikenessFusionService.fuseLikeness(
            { targetDataUrl: TARGET, maxAttempts: 3 },
            geomDeps([0.30, 0.58])
        );
        expect(result.attempts).toHaveLength(2);
        expect(result.similarity).toBeCloseTo(0.58, 10);
        expect(result.passedThreshold).toBe(true);
    });
});
