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

/**
 * Cinematic treatment vocabulary (MIG-010). Framework-neutral descriptions of
 * the compositor-level effects users ask for in plain language ("make it feel
 * like an amber night"): scene backgrounds, velocity-matched seams between
 * clips, kinetic text entrances, counters, and audio fade automation.
 * Engines adapt TO this model; no engine's syntax may appear here.
 */

export type IndiiBackgroundKind = 'solid' | 'radial-glow' | 'grid' | 'ghost-text';

export interface IndiiBackground {
    kind: IndiiBackgroundKind;
    /** Canvas color; defaults to a near-black in the compiler. */
    color?: string;
    /** The one accent hue (glow/grid/ghost tint). */
    accent?: string;
    /** Ghost word rendered very large at low opacity (kind: ghost-text). */
    ghostText?: string;
    /** Glow strength, 0.05–0.5 (kind: radial-glow). */
    glowOpacity?: number;
    /** Where the glow sits (kind: radial-glow). */
    glowPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
}

export type IndiiSeamDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

/**
 * The transition between adjacent clips. cut-the-curve: the outgoing clip
 * accelerates in `direction` and the incoming clip continues the same vector
 * at matched speed — one continuous camera move across the cut.
 */
export interface IndiiSeam {
    type: 'cut-the-curve';
    direction: IndiiSeamDirection;
}

/** Kinetic arrival styles for a clip. */
export interface IndiiEntrance {
    /** waterfall: word-by-word cascade (text only). inverse-zoom: oversized arrival retracting into place. */
    type: 'waterfall' | 'inverse-zoom';
    /** waterfall only — seconds between word arrivals (default 0.05). */
    staggerSeconds?: number;
}

/** Animates a text clip's leading number from 0 to `to` (seek-safe counter). */
export interface IndiiCountUp {
    to: number;
    prefix?: string;
    suffix?: string;
    durationInFrames?: number;
}

/** Volume automation for an audio-bearing clip (audio clip or video with hasAudio). */
export interface IndiiAudioFade {
    inSeconds?: number;
    outSeconds?: number;
}

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
    /** Cinematic arrival treatment (waterfall words / inverse-zoom retraction). */
    entrance?: IndiiEntrance;
    /** Text-only seek-safe counter (e.g. "4 AGENTS" ticks 0→4). */
    countUp?: IndiiCountUp;
    /** Volume automation for audio-bearing clips. */
    audioFade?: IndiiAudioFade;
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
    /** Scene treatment behind all clips. */
    background?: IndiiBackground;
    /** Transition applied at every adjacent-clip boundary. */
    seam?: IndiiSeam;
}

const US_PER_SECOND = 1_000_000;

/** Frames for a microsecond span at the given project fps (matches compiler rounding). */
export const usToFrames = (us: number, fps: number): number =>
    Math.round((us / US_PER_SECOND) * fps);

/** Microseconds for a frame count at the given project fps. */
export const framesToUs = (frames: number, fps: number): number =>
    Math.round((frames / fps) * US_PER_SECOND);
