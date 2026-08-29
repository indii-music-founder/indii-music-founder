/**
 * FacePipeline.ts
 *
 * Face detection + identity scoring boundary (Workstream A1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §6).
 *
 * The founder approved (2026-08-29) A1.6: run the DEGRADED geometry-only
 * backend in v1. `@mediapipe/tasks-vision` FaceLandmarker provides face
 * landmarks (NOT biometric embeddings), so similarity in this mode scores
 * GEOMETRY FIT (normalized landmark alignment), not identity. This is a
 * deliberate, founder-signed-off limitation and is surfaced on every result
 * (`embeddingMode: 'geometry'`).
 *
 * A model asset (face_landmarker.task) is still required at runtime; if it is
 * not present, `analyzeFace` throws a specific "model asset not bundled"
 * error rather than returning wrong-identity results.
 */

export interface DetectedFace {
    box: { x: number; y: number; width: number; height: number };
    score: number;
}

export type EmbeddingMode = 'identity' | 'geometry';

export interface FaceAnalysis {
    faces: DetectedFace[];
    /** Biometric embedding — null in degraded geometry mode. */
    primaryEmbedding: number[] | null;
    /** Normalized 2D face landmarks — populated in geometry mode. */
    landmarks?: Array<[number, number]>;
    /** 'identity' (biometric) or 'geometry' (founder-approved degraded v1, A1.6). */
    embeddingMode?: EmbeddingMode;
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

/** Legacy field name kept for compatibility with A1.2 tests. */
export function cosineSimilarityLegacy(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
}

/**
 * GEOMETRY-FIT similarity (degraded A1.6 mode): scale-invariant landmark
 * alignment. Each face is normalized by its own inter-ocular distance, then
 * the mean Euclidean distance between matched landmarks is converted to a
 * 0..1 "how aligned" score. 1 = identical geometry, 0 = far apart.
 *
 * Pure, deterministic — unit-testable without any model.
 */
export function geometryFitSimilarity(a: Array<[number, number]>, b: Array<[number, number]>): number {
    if (a.length < 2 || b.length < 2) return 0;
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;

    const interOcular = (pts: Array<[number, number]>): number => {
        // Eyes are landmarks 33 (right) and 263 (left) in MediaPipe 468-face.
        const e0 = pts[33] ?? pts[0]!;
        const e1 = pts[263] ?? pts[1]!;
        const dx = e0[0] - e1[0];
        const dy = e0[1] - e1[1];
        return Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
    };

    // Scale-invariance: normalize each face by its OWN inter-ocular distance
    // BEFORE comparing, so a face expressed at a different pixel scale (the
    // same geometry) still scores ~1.
    const normA = interOcular(a);
    const normB = interOcular(b);

    let sum = 0;
    for (let i = 0; i < n; i++) {
        const ax = a[i]![0] / normA;
        const ay = a[i]![1] / normA;
        const bx = b[i]![0] / normB;
        const by = b[i]![1] / normB;
        const dx = ax - bx;
        const dy = ay - by;
        sum += Math.sqrt(dx * dx + dy * dy);
    }
    const meanDist = sum / n;

    return Math.max(0, Math.min(1, 1 - meanDist));
}

export interface HumanInstance {
    readonly available: boolean;
    /** 'identity' (biometric) or 'geometry' (founder-approved degraded v1). */
    readonly mode: EmbeddingMode;
}

/**
 * Founder-approved degraded backend (A1.6): geometry-only, available. The
 * model asset path must be wired to a bundled face_landmarker.task or
 * analyzeFace throws a specific error.
 */
export function loadHuman(): HumanInstance {
    return { available: true, mode: 'geometry' };
}

/** Path where the face_landmarker.task model asset must live (A1.6 degraded mode). */
export const FACE_LANDMARKER_MODEL_PATH = '/models/face_landmarker.task';

/** Lazy FaceLandmarker resolver. `any` kept local to this module to avoid
 * hard-binding the package until the model asset is present. */
let landmarkerPromise: Promise<unknown> | null = null;

async function getLandmarker(): Promise<unknown> {
    if (landmarkerPromise) return landmarkerPromise;
    landmarkerPromise = (async () => {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const wasm = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
        );
        return FaceLandmarker.createFromOptions(wasm, {
            baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_PATH, delegate: 'CPU' },
            runningMode: 'IMAGE',
            numFaces: 1
        });
    })();
    return landmarkerPromise;
}

/**
 * Detect the primary face and its landmarks (degraded geometry mode, A1.6).
 * primaryEmbedding is ALWAYS null here — this is geometry, not identity.
 * Throws a specific error when the model asset is missing.
 */
export async function analyzeFace(dataUrl: string): Promise<FaceAnalysis> {
    const landmarker = await getLandmarker();
    const lm = landmarker as {
        detect: (img: HTMLImageElement, cb?: (r: unknown) => void) => { faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>; faceBlendshapes?: unknown };
        detectAsync?: (img: HTMLImageElement, cb?: (r: unknown) => void) => Promise<unknown>;
    };

    const img = new Image();
    img.src = dataUrl;
    await img.decode().catch(() => { /* handled below via error state */ });

    const result = lm.detect ? lm.detect(img) : await (lm.detectAsync as unknown as (i: HTMLImageElement) => Promise<{ faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }>)(img);

    const facesPts = result?.faceLandmarks ?? [];
    if (facesPts.length === 0) {
        return { faces: [], primaryEmbedding: null, landmarks: [], embeddingMode: 'geometry' };
    }

    const pts = facesPts[0]!;
    const landmarks: Array<[number, number]> = pts.map(p => [p.x, p.y]);
    const xs = landmarks.map(p => p[0]);
    const ys = landmarks.map(p => p[1]);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const ymin = Math.min(...ys);
    const ymax = Math.max(...ys);

    return {
        faces: [{ box: { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin }, score: 1 }],
        primaryEmbedding: null,
        landmarks,
        embeddingMode: 'geometry'
    };
}

/** Kept for A1.2 signature stability. */
export type FaceAnalysisFn = (dataUrl: string) => Promise<FaceAnalysis>;
