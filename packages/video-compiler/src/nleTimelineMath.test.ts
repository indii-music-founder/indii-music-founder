import { describe, it, expect } from 'vitest';
import {
  timeToPts,
  ptsToSeconds,
  rescaleTime,
  addTime,
  subtractTime,
  snapToFrame,
  getSourceOffsetPts,
  isClipActive,
  splitClip,
  rippleEdit,
  DEFAULT_TIMESCALE,
} from './nleTimelineMath.js';
import type { VideoClip, AudioClip, TimelineAST } from '@indii/shared';

describe('nleTimelineMath - Rational Time Engine', () => {
  it('converts seconds to PTS and back accurately', () => {
    const time = timeToPts(1.5, 60000);
    expect(time.pts).toBe(90000n);
    expect(time.timescale).toBe(60000);

    const seconds = ptsToSeconds(time);
    expect(seconds).toBe(1.5);
  });

  it('rescales time between timescales without loss', () => {
    const time = { pts: 1000n, timescale: 1000 }; // 1.0 second
    const rescaled = rescaleTime(time, 60000);
    expect(rescaled.pts).toBe(60000n);
    expect(rescaled.timescale).toBe(60000);
  });

  it('adds and subtracts rational times across mismatched timescales', () => {
    const a = { pts: 30000n, timescale: 60000 }; // 0.5s
    const b = { pts: 1000n, timescale: 1000 };   // 1.0s

    const sum = addTime(a, b);
    expect(ptsToSeconds(sum)).toBeCloseTo(1.5, 5);

    const diff = subtractTime(b, a);
    expect(ptsToSeconds(diff)).toBeCloseTo(0.5, 5);
  });

  describe('snapToFrame', () => {
    it('snaps accurately to 24 fps integer frames', () => {
      // 24 fps in 60000 timescale = 2500 pts per frame
      const frameRate = { num: 24, den: 1 };
      const unaligned = { pts: 2600n, timescale: 60000 };
      const snapped = snapToFrame(unaligned, frameRate);
      expect(snapped.pts).toBe(2500n); // 1 frame
    });

    it('snaps accurately to 30 fps integer frames', () => {
      // 30 fps in 60000 timescale = 2000 pts per frame
      const frameRate = { num: 30, den: 1 };
      const unaligned = { pts: 3100n, timescale: 60000 };
      const snapped = snapToFrame(unaligned, frameRate);
      expect(snapped.pts).toBe(4000n); // 2 frames
    });

    it('snaps accurately to 23.976 fps (24000 / 1001)', () => {
      const frameRate = { num: 24000, den: 1001 };
      // 1 frame at 23.976 = (60000 * 1001) / 24000 = 2502.5 pts
      const unaligned = { pts: 2500n, timescale: 60000 };
      const snapped = snapToFrame(unaligned, frameRate);
      expect(snapped.pts).toBe(2502n);
    });

    it('snaps accurately to 29.97 fps (30000 / 1001)', () => {
      const frameRate = { num: 30000, den: 1001 };
      const unaligned = { pts: 2100n, timescale: 60000 };
      const snapped = snapToFrame(unaligned, frameRate);
      expect(snapped.pts).toBe(2002n);
    });
  });

  describe('getSourceOffsetPts & isClipActive', () => {
    const clip: VideoClip = {
      id: 'clip-1',
      assetId: 'asset-1',
      type: 'video',
      speed: 1.0,
      timelineRange: {
        start: { pts: 60000n, timescale: 60000 },    // 1.0s
        duration: { pts: 120000n, timescale: 60000 }, // 2.0s
      },
      sourceRange: {
        start: { pts: 10000n, timescale: 60000 },
        duration: { pts: 120000n, timescale: 60000 },
      },
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1,
        origin: { x: 0.5, y: 0.5 },
      },
      blendMode: 'normal',
      filters: [],
    };

    it('evaluates clip activity correctly at boundaries', () => {
      expect(isClipActive(59999n, clip)).toBe(false); // Before
      expect(isClipActive(60000n, clip)).toBe(true);  // Start boundary (inclusive)
      expect(isClipActive(100000n, clip)).toBe(true); // Inside
      expect(isClipActive(179999n, clip)).toBe(true); // Right before end
      expect(isClipActive(180000n, clip)).toBe(false); // End boundary (exclusive)
    });

    it('calculates source offset with speed factors', () => {
      // At playhead 120000n (1s into clip)
      const offsetAt1x = getSourceOffsetPts(120000n, clip);
      expect(offsetAt1x).toBe(70000n); // 10000 + 60000

      const fastClip = { ...clip, speed: 2.0 };
      const offsetAt2x = getSourceOffsetPts(120000n, fastClip);
      expect(offsetAt2x).toBe(130000n); // 10000 + (60000 * 2)
    });
  });

  describe('splitClip', () => {
    const videoClip: VideoClip = {
      id: 'v-clip',
      assetId: 'v-asset',
      type: 'video',
      speed: 1.0,
      timelineRange: {
        start: { pts: 0n, timescale: 60000 },
        duration: { pts: 120000n, timescale: 60000 }, // 2s
      },
      sourceRange: {
        start: { pts: 5000n, timescale: 60000 },
        duration: { pts: 120000n, timescale: 60000 },
      },
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1,
        origin: { x: 0.5, y: 0.5 },
      },
      blendMode: 'normal',
      filters: [],
    };

    it('splits clip accurately into left and right subclips', () => {
      const splitPts = 60000n; // 1s
      const [left, right] = splitClip(videoClip, splitPts);

      expect(left.timelineRange.start.pts).toBe(0n);
      expect(left.timelineRange.duration.pts).toBe(60000n);
      expect(left.sourceRange.start.pts).toBe(5000n);
      expect(left.sourceRange.duration.pts).toBe(60000n);

      expect(right.timelineRange.start.pts).toBe(60000n);
      expect(right.timelineRange.duration.pts).toBe(60000n);
      expect(right.sourceRange.start.pts).toBe(65000n);
      expect(right.sourceRange.duration.pts).toBe(60000n);
    });

    it('throws error when split point is outside clip boundaries', () => {
      expect(() => splitClip(videoClip, 0n)).toThrow();
      expect(() => splitClip(videoClip, 120000n)).toThrow();
      expect(() => splitClip(videoClip, 150000n)).toThrow();
    });
  });

  describe('rippleEdit', () => {
    const ast: TimelineAST = {
      version: 1,
      id: 'ast-1',
      timebase: 60000,
      dimensions: { width: 1920, height: 1080 },
      audioFormat: { sampleRate: 48000, channels: 2 },
      tracks: [
        {
          id: 'v-track-1',
          type: 'video',
          index: 0,
          muted: false,
          locked: false,
          clips: [
            {
              id: 'clip-a',
              assetId: 'asset-a',
              type: 'video',
              speed: 1.0,
              timelineRange: {
                start: { pts: 0n, timescale: 60000 },
                duration: { pts: 60000n, timescale: 60000 },
              },
              sourceRange: {
                start: { pts: 0n, timescale: 60000 },
                duration: { pts: 60000n, timescale: 60000 },
              },
              transform: {
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotation: 0,
                opacity: 1,
                origin: { x: 0.5, y: 0.5 },
              },
              blendMode: 'normal',
              filters: [],
            },
            {
              id: 'clip-b',
              assetId: 'asset-b',
              type: 'video',
              speed: 1.0,
              timelineRange: {
                start: { pts: 60000n, timescale: 60000 },
                duration: { pts: 60000n, timescale: 60000 },
              },
              sourceRange: {
                start: { pts: 0n, timescale: 60000 },
                duration: { pts: 60000n, timescale: 60000 },
              },
              transform: {
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotation: 0,
                opacity: 1,
                origin: { x: 0.5, y: 0.5 },
              },
              blendMode: 'normal',
              filters: [],
            },
          ],
        },
      ],
    };

    it('expands clip duration and shifts subsequent clips forward', () => {
      const deltaPts = 30000n; // +0.5s
      const updated = rippleEdit(ast, 'v-track-1', 'clip-a', deltaPts);

      const track = updated.tracks[0];
      expect(track.clips[0].timelineRange.duration.pts).toBe(90000n);
      expect(track.clips[1].timelineRange.start.pts).toBe(90000n);
      expect(track.clips[1].timelineRange.duration.pts).toBe(60000n);
    });

    it('contracts clip duration and pulls subsequent clips backward', () => {
      const deltaPts = -20000n; // -0.333s
      const updated = rippleEdit(ast, 'v-track-1', 'clip-a', deltaPts);

      const track = updated.tracks[0];
      expect(track.clips[0].timelineRange.duration.pts).toBe(40000n);
      expect(track.clips[1].timelineRange.start.pts).toBe(40000n);
    });

    it('throws error if ripple reduction results in non-positive duration', () => {
      expect(() => rippleEdit(ast, 'v-track-1', 'clip-a', -60000n)).toThrow();
    });
  });
});
