/**
 * FacePipeline.ts
 *
 * Face detection + identity embedding boundary (Workstream A1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §6).
 *
 * The REAL identity backend (`@vladmandic/human`) is NOT installed and its
 * weights must be vendored locally (A1.1). The geometry-only
 * `@mediapipe/tasks-vision` FaceLandmarker is a DEGRADED fallback (A1.6) and
 * requires founder sign-off before being shipped as the identity path.
 *
 * Therefore this module intentionally does NOT silently substitute a
 * degraded scorer: until a real identity backend is configured (or the
 * founder explicitly approves the degraded mode), `analyzeFace` throws a
 * specific, honest error naming the missing configuration. The orchestration
 * loop, thresholds, and tool are all testable with an INJECTED backend (A1.3).
 */

export interface DetectedFace {
    box: { x: number; y: number; width: number; height: number };
    score: number;
}

export interface FaceAnalysis {
    faces: DetectedFace[];
    primaryEmbedding: number[] | null;
}

/**
 * Cosine similarity between two non-empty, equal-length vectors.
 * identical = 1, orthogonal = 0, inverted = -1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) throw new Error('cosineSimilarity: vectors must be non-empty');
    if (a.length !== b.length) throw new Error('cosineSimilarity: dimension mismatch');

    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        na += a[i]! * a[i]!;
        nb += b[i]! * b[i]!;
    }
    if (na === 0 || nb === 0) throw new Error('cosineSimilarity: zero-magnitude vector');

    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Human model backend resolution. Only "local weights, no network" is allowed;
 * a model URL fetch would violate A1.1.
 */
export interface HumanInstance {
    /** @returns whether a real identity-capable backend is present/configured. */
    readonly available: boolean;
}

export type FaceAnalysisFn = (dataUrl: string) => Promise<FaceAnalysis>;

/**
 * Lazy singleton for the identity backend. The real `@vladmandic/human`
 * backend is not installed; this returns an instance that reports
 * `available: false` until a backend is configured. We never fetch weights
 * from the network here (A1.1).
 */
export function loadHuman(): HumanInstance {
    // Identity backend not installed (A1.1). Deliberately not substituted with
    // the geometry-only degraded FaceLandmarker unless the founder approves it
    // (A1.6). Return an honest, unavailable instance.
    return { available: false };
}

/**
 * Detect + embed the primary face. Requires a real identity backend; throws a
 * specific, actionable error when none is configured.
 */
export async function analyzeFace(_dataUrl: string): Promise<FaceAnalysis> {
    throw new Error(
        'FacePipeline: no identity backend is configured. Install @vladmandic/human with vendored local weights (A1.1), or get founder sign-off to run the degraded geometry-only mode (A1.6).'
    );
}
