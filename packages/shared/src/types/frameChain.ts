/**
 * Frame-Chained Video Generation & Beat-Snapped Timeline Types (MIG-011, ADR-002)
 *
 * Owned by @indii/shared. Defines data contracts for:
 * - Dual Aspect Ratio (16:9 Landscape & 9:16 Vertical)
 * - Dramatic Beat-Snapped Timeline Slicing
 * - Terminal Frame Chaining (F_last -> F_0)
 * - Multimodal Omni Flash Editing with boundary anchor locking
 * - Firestore indii.music release video persistence
 */

export type AspectRatioKey = '16:9' | '9:16';

export interface AspectRatioDimension {
    name: AspectRatioKey;
    width: number;
    height: number;
}

export const ASPECT_RATIO_SPECS: Record<AspectRatioKey, AspectRatioDimension> = {
    '16:9': { name: '16:9', width: 1920, height: 1080 },
    '9:16': { name: '9:16', width: 1080, height: 1920 }
};

export interface FrameChainSegment {
    segmentIndex: number;
    title: string;
    prompt: string;
    durationSeconds: number;
    initialFrameUri?: string; // F_0 base reference or previous F_last
    terminalFrameUri?: string; // Extracted F_last
    terminalFrameExtracted?: boolean;
    rawVideoUri?: string;
    editedVideoUri?: string;
    continuityScore?: number;
}

export interface BeatSnappedTimelineSpec {
    bpm: number;
    timeSignature?: [number, number]; // default [4, 4]
    barDurationSeconds: number;
    transientDropSeconds: number[];
    transitionDurationSeconds: number;
    transitionOffsets: number[];
    targetTotalDurationSeconds: number;
}

export interface DualAspectMaster {
    aspectRatio: AspectRatioKey;
    resolution: { width: number; height: number };
    duration: number;
    fps: number;
    gcsStorageUri?: string;
    publicDownloadUrl?: string;
    localPath?: string;
}

export interface FrameChainManifest {
    manifestId: string;
    projectId: string;
    releaseId: string;
    artistId: string;
    status: 'pending' | 'generating' | 'chaining' | 'editing' | 'stitching' | 'completed' | 'failed';
    aspectRatios: AspectRatioKey[];
    beatSnap: BeatSnappedTimelineSpec;
    segments: FrameChainSegment[];
    masters?: Partial<Record<AspectRatioKey, DualAspectMaster>>;
    outputMasterGcsUri?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OmniFlashEditInstruction {
    segmentIndex: number;
    instruction: string;
    lockBoundaryMarginSeconds: number; // Anchor margin to protect xfade transitions
    styleDirectives?: {
        lighting?: string;
        colorGrade?: string;
        motionIntensity?: 'low' | 'medium' | 'high';
        filmStock?: string;
    };
}

export interface ContinuityEvaluationResult {
    segmentIndexFrom: number;
    segmentIndexTo: number;
    score: number; // 0.0 - 1.0 (>= 0.85 acceptable)
    subjectMatch: boolean;
    lightingConsistency: boolean;
    recommendation: 'accept' | 'regenerate' | 'interpolate';
    reasoning: string;
}

export interface FirestoreReleaseVideoRecord {
    releaseId: string;
    artistId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    audioSync: {
        bpm: number;
        beatSnapped: boolean;
        barDurationSeconds: number;
        transientDropSeconds: number[];
    };
    masters: {
        landscape?: {
            aspectRatio: '16:9';
            resolution: { width: number; height: number };
            duration: number;
            gcsStorageUri?: string;
            localPath?: string;
        };
        vertical?: {
            aspectRatio: '9:16';
            resolution: { width: number; height: number };
            duration: number;
            gcsStorageUri?: string;
            localPath?: string;
        };
    };
    chainedSegments: Array<{
        segmentIndex: number;
        title: string;
        prompt: string;
        durationSeconds: number;
        terminalFrameExtracted: boolean;
        continuityScore?: number;
    }>;
    createdAt: string;
    completedAt?: string;
    error?: string;
}
