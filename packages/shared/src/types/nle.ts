/**
 * Core Data Schemas & TypeScript Definitions for the Open-Source
 * Non-Linear Editing (NLE) Engine (Issue #413).
 *
 * Implements rational time primitives, timeline AST, media metadata,
 * keyframes, and multitrack composition nodes with integer PTS math.
 */

// --- Rational Time Primitives ---
export interface RationalTime {
  /** Presentation time stamp as integer */
  pts: bigint;
  /** Standard base timescale: 60000 (allows 23.976, 24, 29.97, 30, 60 fps integer mapping) */
  timescale: number;
}

export interface TimeRange {
  start: RationalTime;
  duration: RationalTime;
}

// --- Asset Metadata ---
export interface MediaMetadata {
  id: string;
  sourceUri: string;
  hashSha256: string;
  format: string;
  durationUs: number;
  video?: {
    width: number;
    height: number;
    codec: 'h264' | 'h265' | 'vp9' | 'av1' | 'prores';
    pixFmt: string;
    colorSpace: string;
    isVFR: boolean;
    frameRate: { num: number; den: number };
    keyframeIndices: number[]; // Presentation times of IDR/I-frames
  };
  audio?: {
    codec: 'aac' | 'pcm_s16le' | 'pcm_s24le' | 'pcm_f32le' | 'opus';
    sampleRate: number;
    channels: number;
    channelLayout: 'mono' | 'stereo' | '5.1';
  };
}

// --- Keyframes & Transforms ---
export interface Keyframe<T> {
  time: RationalTime;
  value: T;
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'bezier' | 'hold';
  bezierHandles?: { cp1: [number, number]; cp2: [number, number] };
}

export interface Transform2D {
  position: { x: number; y: number }; // Normalized coordinate space [-1.0, 1.0]
  scale: { x: number; y: number };
  rotation: number;                   // Radians
  opacity: number;                    // 0.0 to 1.0
  origin: { x: number; y: number };   // Anchor point [0.5, 0.5] default
}

// --- Timeline AST ---
export interface BaseClip {
  id: string;
  assetId: string;
  timelineRange: TimeRange;  // Position and length on the timeline
  sourceRange: TimeRange;    // Trim points within the source media file
  speed: number;             // Playback rate factor (e.g. 1.0)
}

export interface FilterNode {
  id: string;
  type: string;
  params: Record<string, number | string | boolean>;
}

export interface VideoClip extends BaseClip {
  type: 'video';
  transform: Transform2D;
  transformKeyframes?: Keyframe<Partial<Transform2D>>[];
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
  filters: FilterNode[];
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  gain: number;              // Linear scalar (1.0 = 0dB)
  pan: number;               // -1.0 (Left) to +1.0 (Right)
  gainKeyframes?: Keyframe<number>[];
  panKeyframes?: Keyframe<number>[];
  busAssignment: string;     // e.g., 'master' | 'music' | 'sfx' | 'dialogue'
}

export interface NLETrack {
  id: string;
  type: 'video' | 'audio';
  index: number;
  muted: boolean;
  locked: boolean;
  clips: (VideoClip | AudioClip)[];
}

/** Alias for NLETrack within timeline contexts */
export type TimelineTrack = NLETrack;

export interface TimelineAST {
  version: 1;
  id: string;
  timebase: number;          // Default 60000
  dimensions: { width: number; height: number };
  audioFormat: { sampleRate: 48000; channels: 2 };
  tracks: NLETrack[];
}
