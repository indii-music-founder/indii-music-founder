/**
 * FacePipeline.ts
 *
 * Face detection + identity scoring boundary (Workstream A1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §6).
 *
 * Identity backend: `@vladmandic/human` (MIT, open source — founder policy
 * 2026-08-31). `faceres` produces a real biometric face descriptor, so
 * `analyzeFace` returns `embeddingMode: 'identity'` + a `primaryEmbedding`.
 * Models are vendored under `public/models/human/` (no CDN fetch).
 *
 * Fallback: `@mediapipe/tasks-vision` FaceLandmarker geometry mode (A1.6)
 * when the identity backend fails to load.
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
 * Identity backend (@vladmandic/human, MIT) is installed and its face models
 * are vendored under public/models/human/ — so identity mode is available.
 */
export function loadHuman(): HumanInstance {
    return { available: true, mode: 'identity' };
}

/** Vendored model path for the @vladmandic/human face models (MIT). */
export const HUMAN_MODEL_PATH = '/models/human/';

let humanPromise: Promise<HumanLike> | null = null;

type HumanLike = {
    load: () => Promise<void>;
    detect: (img: HTMLImageElement) => Promise<{ face?: HumanFace[] }>;
};

type HumanFace = {
    box: { x: number; y: number; width: number; height: number };
    score: number;
    embedding?: number[];
};

/** Lazy-load the @vladmandic/human runtime (bundled tfjs) + vendored models. */
async function getHuman(): Promise<HumanLike> {
    if (humanPromise) return humanPromise;
    humanPromise = (async () => {
        const { default: Human } = await import('@vladmandic/human');
        const Ctor = Human as unknown as new (config: Record<string, unknown>) => HumanLike;
        const human = new Ctor({
            modelBasePath: HUMAN_MODEL_PATH,
            backend: 'webgl',
            debug: false,
            face: {
                enabled: true,
                detector: { enabled: true, modelPath: 'blazeface.json' },
                mesh: { enabled: false },
                description: { enabled: true, modelPath: 'faceres.json' },
                emotion: { enabled: false },
                iris: { enabled: false },
                liveness: { enabled: false },
                antispoof: { enabled: false },
            },
            body: { enabled: false },
            hand: { enabled: false },
            object: { enabled: false },
            segmentation: { enabled: false },
            gesture: { enabled: false },
        });
        await human.load();
        return human;
    })();
    return humanPromise;
}

/**
 * Real biometric identity: detect the primary face and return its face
 * descriptor embedding (`embeddingMode: 'identity'`).
 */
export async function analyzeFaceIdentity(dataUrl: string): Promise<FaceAnalysis> {
    const human = await getHuman();
    const img = new Image();
    img.src = dataUrl;
    await img.decode().catch(() => { /* handled below via empty result */ });

    const result = await human.detect(img);
    const face = result.face?.[0];
    if (!face || !face.embedding || face.embedding.length === 0) {
        throw new Error('analyzeFaceIdentity: no face or embedding detected');
    }

    return {
        faces: [{ box: face.box, score: face.score ?? 1 }],
        primaryEmbedding: face.embedding,
        landmarks: [],
        embeddingMode: 'identity',
    };
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
async function analyzeFaceGeometry(dataUrl: string): Promise<FaceAnalysis> {
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

/**
 * Analyze a face: identity (biometric embedding) first, geometry fallback
 * when the identity backend fails to load.
 */
export async function analyzeFace(dataUrl: string): Promise<FaceAnalysis> {
    try {
        return await analyzeFaceIdentity(dataUrl);
    } catch {
        return analyzeFaceGeometry(dataUrl);
    }
}

/** Kept for A1.2 signature stability. */
export type FaceAnalysisFn = (dataUrl: string) => Promise<FaceAnalysis>;
