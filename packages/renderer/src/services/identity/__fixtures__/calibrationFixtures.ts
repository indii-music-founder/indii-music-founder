/**
 * calibrationFixtures.ts
 *
 * Deterministic calibration fixtures for Likeness Locking (Tool 1 / Workstream A1).
 * Provides 5 known-same identity pairs and 5 known-different identity pairs
 * across both:
 *  1. Biometric 128-dimensional identity embeddings (for identity mode)
 *  2. Normalized 2D facial landmark arrays (for degraded geometry mode)
 *
 * Mathematically constructed to provide a guaranteed positive separation margin:
 * - Same identity similarity: ~0.90 to 0.99
 * - Different identity similarity: ~0.08 to 0.30 (identity), ~0.0 to 0.58 (geometry)
 * - Separation band cleanly accommodates the default IDENTITY_SIMILARITY_THRESHOLD (0.55).
 */

import type { CalibrationSample } from '../FacePipeline';

export const BASE_EMBEDDING_128: number[] = [
    0.027005, 0.066497, 0.103732, 0.136459, 0.162624, 0.180479, 0.188737, 0.186638,
    0.173995, 0.151325, 0.119794, 0.081156, 0.037583, -0.008434, -0.053746, -0.095945,
    -0.132711, -0.161957, -0.181977, -0.191507, -0.189767, -0.176529, -0.152225, -0.118029,
    -0.075796, -0.027967, 0.022572, 0.072898, 0.119864, 0.160417, 0.191763, 0.211462,
    0.217744, 0.209673, 0.187212, 0.151242, 0.103444, 0.046187, -0.017772, -0.084128,
    -0.149176, -0.208945, -0.259682, -0.298096, -0.321689, -0.328768, -0.318447, -0.290744,
    -0.246498, -0.187313, -0.115456, -0.033783, 0.054366, 0.145151, 0.234389, 0.317804,
    0.391206, 0.450702, 0.493012, 0.515647, 0.517025, 0.496541, 0.454593, 0.392576,
    0.312882, 0.218844, 0.114647, 0.005086, -0.104085, -0.207907, -0.301546, -0.380582,
    -0.441195, -0.480287, -0.495475, -0.485292, -0.449175, -0.387532, -0.301826, -0.194723,
    -0.070087, 0.067345, 0.212001, 0.357878, 0.498807, 0.628795, 0.742168, 0.833955,
    0.899896, 0.936647, 0.941865, 0.914285, 0.853768, 0.761358, 0.639352, 0.491228,
    0.321612, 0.136065, -0.059495, -0.257271, -0.449079, -0.626786, -0.782483, -0.908819,
    -0.999672, -1.049818, -1.055278, -1.014264, -0.927236, -0.796856, -0.627914, -0.427186,
    -0.203063, 0.034563, 0.274154, 0.504285, 0.713725, 0.892095, 1.030438, 1.121303,
    1.159048, 1.140134, 1.063259, 0.929381, 0.741639, 0.505244, 0.227442, -0.082001
];

// Normalize base embedding to unit length
const baseMag = Math.sqrt(BASE_EMBEDDING_128.reduce((sum, val) => sum + val * val, 0));
export const NORMALIZED_BASE_EMBEDDING = BASE_EMBEDDING_128.map(v => v / baseMag);

/**
 * 8 key normalized 2D facial landmarks.
 * Index 0 (right eye, landmark 33) and index 1 (left eye, landmark 263)
 * define the inter-ocular scale baseline.
 */
export const BASE_LANDMARKS_2D: Array<[number, number]> = [
    [0.35, 0.40], // right eye (MediaPipe 33)
    [0.65, 0.40], // left eye (MediaPipe 263)
    [0.50, 0.52], // nose tip
    [0.50, 0.68], // upper lip
    [0.50, 0.76], // lower lip
    [0.50, 0.88], // chin
    [0.26, 0.58], // right cheek
    [0.74, 0.58]  // left cheek
];

/**
 * Helper to produce a unit-normalized vector.
 */
function normalizeVector(v: number[]): number[] {
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return v.map(x => x / mag);
}

/**
 * Helper to construct an embedding with deterministic cosine similarity to base.
 */
function createSyntheticEmbedding(targetSimilarity: number, seedOffset: number): number[] {
    const raw = Array.from({ length: 128 }, (_, i) => Math.cos((i + seedOffset) * 0.35));
    let dot = 0;
    for (let i = 0; i < 128; i++) dot += raw[i]! * NORMALIZED_BASE_EMBEDDING[i]!;
    // Gram-Schmidt orthogonalization against base
    const ortho = normalizeVector(raw.map((r, i) => r - dot * NORMALIZED_BASE_EMBEDDING[i]!));
    const combined = NORMALIZED_BASE_EMBEDDING.map((b, i) =>
        b * targetSimilarity + ortho[i]! * Math.sqrt(Math.max(0, 1 - targetSimilarity * targetSimilarity))
    );
    return normalizeVector(combined);
}

/**
 * 5 Known-Same Calibration Pairs (Founder Likeness vs Authenticated Variations)
 * High identity similarity: 0.91 to 0.98.
 * High geometry similarity: 0.98 to 1.00.
 */
export const KNOWN_SAME_PAIRS: CalibrationSample[] = [
    {
        id: 'same_01_natural_vs_studio_lighting',
        isSameIdentity: true,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.97, 13),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x * 1.05, y * 1.05])
        }
    },
    {
        id: 'same_02_slight_head_tilt_5deg',
        isSameIdentity: true,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.95, 29),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x + 0.002, y - 0.001])
        }
    },
    {
        id: 'same_03_expression_neutral_vs_subtle_smile',
        isSameIdentity: true,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.93, 47),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x * 0.95, y * 0.95])
        }
    },
    {
        id: 'same_04_focal_length_distance_shift',
        isSameIdentity: true,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.94, 61),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x * 1.20, y * 1.20])
        }
    },
    {
        id: 'same_05_gentle_hair_and_rim_lighting_variation',
        isSameIdentity: true,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.91, 83),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x + 0.001, y + 0.002])
        }
    }
];

/**
 * 5 Known-Different Calibration Pairs (Founder Likeness vs Completely Different Subjects)
 * Low identity similarity: 0.08 to 0.28.
 * Low geometry similarity: 0.00 to 0.45.
 */
export const KNOWN_DIFFERENT_PAIRS: CalibrationSample[] = [
    {
        id: 'diff_01_distinct_demographic_and_bone_structure',
        isSameIdentity: false,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.08, 101),
            landmarks: BASE_LANDMARKS_2D.map(([x, y], i) =>
                i === 0 ? [x - 0.15, y] : i === 1 ? [x + 0.15, y] : [x, y * 1.25]
            )
        }
    },
    {
        id: 'diff_02_different_jawline_and_vertical_ratios',
        isSameIdentity: false,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.15, 127),
            landmarks: BASE_LANDMARKS_2D.map(([x, y], i) =>
                i === 2 ? [x, y - 0.15] : [x, y * 0.75]
            )
        }
    },
    {
        id: 'diff_03_different_head_shape_and_narrow_eyes',
        isSameIdentity: false,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.20, 149),
            landmarks: BASE_LANDMARKS_2D.map(([x, y]) => [x * 0.5, y * 1.4])
        }
    },
    {
        id: 'diff_04_different_facial_feature_placement',
        isSameIdentity: false,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.25, 173),
            landmarks: BASE_LANDMARKS_2D.map(([x, y], i) =>
                i === 0 ? [x - 0.08, y] : i === 1 ? [x + 0.08, y] : i >= 3 ? [x, y - 0.22] : [x, y]
            )
        }
    },
    {
        id: 'diff_05_asymmetric_alternative_subject',
        isSameIdentity: false,
        a: {
            embedding: NORMALIZED_BASE_EMBEDDING,
            landmarks: BASE_LANDMARKS_2D
        },
        b: {
            embedding: createSyntheticEmbedding(0.28, 199),
            landmarks: BASE_LANDMARKS_2D.map(([x, y], i) =>
                i % 2 === 0 ? [x + 0.08, y - 0.08] : [x - 0.08, y + 0.08]
            )
        }
    }
];

export const ALL_CALIBRATION_PAIRS = [...KNOWN_SAME_PAIRS, ...KNOWN_DIFFERENT_PAIRS];
