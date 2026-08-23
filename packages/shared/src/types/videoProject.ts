/**
 * IndiiVideoProject — the framework-neutral video project model. (MIG-001, ADR-001)
 *
 * indii.music owns this model. No rendering engine's types may appear here;
 * engines adapt TO this model, never the reverse. Renderer-side names
 * (`VideoProject`, `VideoClip`, …) are compatibility aliases of these types.
 *
 * Timing contract:
 * - Frame fields (`startFrame`, `durationInFrames`, keyframe `frame`) are the
 *   persisted editor timeline representation.
 * - Microseconds (µs) are canonical for source-media trim boundaries. Use the
 *   helpers below instead of hand-multiplying when crossing representations.
 *   (Field names are generic film/timeline vocabulary, deliberately kept so that
 *   persisted documents remain stable across the engine migration.)
 */

export type IndiiClipType = 'video' | 'image' | 'text' | 'audio';

/** Immutable audio identity sent to render backends; preview URLs are not authority. */
export interface IndiiCanonicalMasterRenderReference {
    contentHash: string;
    /** Immutable Cloud Storage generation profiled by the server worker. Legacy references may lack it. */
    generation?: string;
    masterFingerprint: string;
    storagePath: string;
    volume: number;
}

export interface IndiiVideoClip {
    id: string;
    type: IndiiClipType;
    src?: string; // URL for video/image/audio
    text?: string; // Content for text
    startFrame: number;
    durationInFrames: number;
    trackId: string;
    name: string;
    // Visual properties
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scale?: number;
    opacity?: number;
    rotation?: number;
    anchorX?: number; // 0 to 1 (percentage)
    anchorY?: number; // 0 to 1 (percentage)
    borderRadius?: number;
    volume?: number; // 0 to 1
    /** Verified by media probing; controls whether a video gets a separate audio element. */
    hasAudio?: boolean;
    masterFingerprint?: string;
    isrc?: string;
    canonicalMaster?: IndiiCanonicalMasterRenderReference;
    /** Server-owned GCS identity for cloud renders; `src` remains preview-only. */
    canonicalSourceUri?: string;
    // Text specific properties
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    filter?: {
        type: 'blur' | 'grayscale' | 'sepia' | 'contrast' | 'brightness';
        intensity: number; // 0-100
    };
    transitionIn?: { type: 'fade' | 'slide' | 'wipe' | 'zoom'; duration: number };
    transitionOut?: { type: 'fade' | 'slide' | 'wipe' | 'zoom'; duration: number };
    keyframes?: {
        [key: string]: Array<{
            frame: number; // Relative to clip start
            value: number;
            easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
        }>;
    };
    // Session Breakdown & Master Sync fields (ISSUE-1180) — µs is canonical
    sourceInUs?: number;
    sourceOutUs?: number;
    sourceGeneration?: string;
    proxyGeneration?: string;
    syncAlignmentId?: string;
    syncLock?: boolean;
    audioRecipeId?: string;
    approvalReceiptId?: string;
    planId?: string;
}

export interface IndiiVideoTrack {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'text'; // Simplified track types for now
    isMuted?: boolean;
    isHidden?: boolean;
}

export interface IndiiVideoProject {
    id: string;
    name: string;
    fps: number;
    durationInFrames: number;
    width: number;
    height: number;
    tracks: IndiiVideoTrack[];
    clips: IndiiVideoClip[];
}

const US_PER_SECOND = 1_000_000;

/** Frames for a microsecond span at the given project fps (matches compiler rounding). */
export const usToFrames = (us: number, fps: number): number =>
    Math.round((us / US_PER_SECOND) * fps);

/** Microseconds for a frame count at the given project fps. */
export const framesToUs = (frames: number, fps: number): number =>
    Math.round((frames / fps) * US_PER_SECOND);
