/**
 * Timeline Math Engine for the Open-Source NLE Engine (Issue #413).
 *
 * All timeline calculations use integer arithmetic over rational fractions
 * to eliminate cumulative floating-point drift across multi-track playback.
 */

import type {
  RationalTime,
  TimeRange,
  BaseClip,
  VideoClip,
  AudioClip,
  TimelineAST,
  NLETrack,
} from '@indii/shared';

export const DEFAULT_TIMESCALE = 60000;

/**
 * Converts seconds to a RationalTime structure with exact bigint PTS.
 */
export function timeToPts(seconds: number, timescale = DEFAULT_TIMESCALE): RationalTime {
  const pts = BigInt(Math.round(seconds * timescale));
  return { pts, timescale };
}

/**
 * Converts RationalTime back to fractional seconds.
 */
export function ptsToSeconds(time: RationalTime): number {
  if (time.timescale === 0) return 0;
  return Number(time.pts) / time.timescale;
}

/**
 * Converts a RationalTime to a target timescale without precision loss.
 */
export function rescaleTime(time: RationalTime, targetTimescale: number): RationalTime {
  if (time.timescale === targetTimescale) return time;
  const newPts = (time.pts * BigInt(targetTimescale)) / BigInt(time.timescale);
  return { pts: newPts, timescale: targetTimescale };
}

/**
 * Adds two RationalTime instances, harmonizing timescales if necessary.
 */
export function addTime(a: RationalTime, b: RationalTime): RationalTime {
  if (a.timescale === b.timescale) {
    return { pts: a.pts + b.pts, timescale: a.timescale };
  }
  const commonTimescale = a.timescale * b.timescale;
  const aPts = a.pts * BigInt(b.timescale);
  const bPts = b.pts * BigInt(a.timescale);
  return { pts: aPts + bPts, timescale: commonTimescale };
}

/**
 * Subtracts RationalTime b from a, harmonizing timescales if necessary.
 */
export function subtractTime(a: RationalTime, b: RationalTime): RationalTime {
  if (a.timescale === b.timescale) {
    return { pts: a.pts - b.pts, timescale: a.timescale };
  }
  const commonTimescale = a.timescale * b.timescale;
  const aPts = a.pts * BigInt(b.timescale);
  const bPts = b.pts * BigInt(a.timescale);
  return { pts: aPts - bPts, timescale: commonTimescale };
}

/**
 * Snaps a given RationalTime to the nearest frame boundary for the specified frame rate.
 * Supports standard integer (24, 25, 30, 60) and fractional frame rates (23.976, 29.97).
 */
export function snapToFrame(
  time: RationalTime,
  frameRate: { num: number; den: number }
): RationalTime {
  if (frameRate.num <= 0 || frameRate.den <= 0) return time;

  // Frame duration in rational PTS: timescale * den / num
  // Calculate frame index: round( (pts * num) / (timescale * den) )
  const numBig = BigInt(frameRate.num);
  const denBig = BigInt(frameRate.den);
  const timescaleBig = BigInt(time.timescale);

  const totalNumerator = time.pts * numBig;
  const totalDenominator = timescaleBig * denBig;

  // Perform half-up rounding in integer arithmetic
  const halfDen = totalDenominator / 2n;
  const frameIndex = totalNumerator >= 0n
    ? (totalNumerator + halfDen) / totalDenominator
    : (totalNumerator - halfDen) / totalDenominator;

  // Convert frameIndex back to PTS: (frameIndex * timescale * den) / num
  const snappedPts = (frameIndex * timescaleBig * denBig) / numBig;

  return {
    pts: snappedPts,
    timescale: time.timescale,
  };
}

/**
 * Calculates the exact source file PTS offset when the playhead is located at playheadPts.
 * Takes clip playback speed into account.
 */
export function getSourceOffsetPts(
  playheadPts: bigint,
  clip: VideoClip | AudioClip,
  timescale = DEFAULT_TIMESCALE
): bigint {
  const startPts = rescaleTime(clip.timelineRange.start, timescale).pts;
  const elapsedTimelinePts = playheadPts - startPts;
  const scaledElapsed = BigInt(Math.round(Number(elapsedTimelinePts) * clip.speed));
  const sourceStartPts = rescaleTime(clip.sourceRange.start, timescale).pts;
  return sourceStartPts + scaledElapsed;
}

/**
 * Returns true if the playhead falls within the clip's active timeline interval [start, start + duration).
 */
export function isClipActive(playheadPts: bigint, clip: BaseClip, timescale = DEFAULT_TIMESCALE): boolean {
  const startPts = rescaleTime(clip.timelineRange.start, timescale).pts;
  const durPts = rescaleTime(clip.timelineRange.duration, timescale).pts;
  const endPts = startPts + durPts;
  return playheadPts >= startPts && playheadPts < endPts;
}

/**
 * Splits a clip into two continuous sub-clips at splitTimelinePts.
 * Validates that splitTimelinePts is strictly within the clip boundary.
 */
export function splitClip<T extends VideoClip | AudioClip>(
  clip: T,
  splitTimelinePts: bigint,
  timescale = DEFAULT_TIMESCALE
): [T, T] {
  const clipStartPts = rescaleTime(clip.timelineRange.start, timescale).pts;
  const clipDurPts = rescaleTime(clip.timelineRange.duration, timescale).pts;
  const clipEndPts = clipStartPts + clipDurPts;

  if (splitTimelinePts <= clipStartPts || splitTimelinePts >= clipEndPts) {
    throw new Error(
      `Cannot split clip ${clip.id}: split point ${splitTimelinePts} is outside interval (${clipStartPts}, ${clipEndPts})`
    );
  }

  const leftDurationPts = splitTimelinePts - clipStartPts;
  const rightDurationPts = clipEndPts - splitTimelinePts;

  // Source media range adjustments
  const clipSourceStartPts = rescaleTime(clip.sourceRange.start, timescale).pts;
  const sourceCutDeltaPts = BigInt(Math.round(Number(leftDurationPts) * clip.speed));

  const leftSourceDurationPts = sourceCutDeltaPts;
  const rightSourceDurationPts = rescaleTime(clip.sourceRange.duration, timescale).pts - sourceCutDeltaPts;

  const leftClip: T = {
    ...clip,
    id: `${clip.id}_left_${splitTimelinePts}`,
    timelineRange: {
      start: { pts: clipStartPts, timescale },
      duration: { pts: leftDurationPts, timescale },
    },
    sourceRange: {
      start: { pts: clipSourceStartPts, timescale },
      duration: { pts: leftSourceDurationPts, timescale },
    },
  };

  const rightClip: T = {
    ...clip,
    id: `${clip.id}_right_${splitTimelinePts}`,
    timelineRange: {
      start: { pts: splitTimelinePts, timescale },
      duration: { pts: rightDurationPts, timescale },
    },
    sourceRange: {
      start: { pts: clipSourceStartPts + sourceCutDeltaPts, timescale },
      duration: { pts: rightSourceDurationPts, timescale },
    },
  };

  return [leftClip, rightClip];
}

/**
 * Performs an immutable ripple edit on an AST track:
 * Adjusts duration of clipId by deltaPts and shifts all subsequent clips on the same track.
 */
export function rippleEdit(
  ast: TimelineAST,
  trackId: string,
  clipId: string,
  deltaPts: bigint,
  timescale = DEFAULT_TIMESCALE
): TimelineAST {
  const updatedTracks: NLETrack[] = ast.tracks.map((track) => {
    if (track.id !== trackId) return track;

    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip ${clipId} not found on track ${trackId}`);
    }

    const targetClip = track.clips[clipIndex];
    const currentDurPts = rescaleTime(targetClip.timelineRange.duration, timescale).pts;
    const newDurPts = currentDurPts + deltaPts;

    if (newDurPts <= 0n) {
      throw new Error(`Ripple edit failed: resulting duration ${newDurPts} must be positive.`);
    }

    const currentSourceDurPts = rescaleTime(targetClip.sourceRange.duration, timescale).pts;
    const sourceDeltaPts = BigInt(Math.round(Number(deltaPts) * targetClip.speed));
    const newSourceDurPts = currentSourceDurPts + sourceDeltaPts;

    const updatedClips = track.clips.map((clip, index) => {
      if (index === clipIndex) {
        return {
          ...clip,
          timelineRange: {
            ...clip.timelineRange,
            duration: { pts: newDurPts, timescale },
          },
          sourceRange: {
            ...clip.sourceRange,
            duration: { pts: newSourceDurPts, timescale },
          },
        };
      }

      if (index > clipIndex) {
        // Shift start time by deltaPts
        const currentStartPts = rescaleTime(clip.timelineRange.start, timescale).pts;
        const newStartPts = currentStartPts + deltaPts;
        return {
          ...clip,
          timelineRange: {
            ...clip.timelineRange,
            start: { pts: newStartPts, timescale },
          },
        };
      }

      return clip;
    });

    return {
      ...track,
      clips: updatedClips,
    };
  });

  return {
    ...ast,
    tracks: updatedTracks,
  };
}
