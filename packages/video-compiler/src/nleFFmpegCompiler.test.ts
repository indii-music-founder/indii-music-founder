import { describe, it, expect } from 'vitest';
import { compileFfmpegCommand } from './nleFFmpegCompiler.js';
import type { TimelineAST } from '@indii/shared';

describe('nleFFmpegCompiler - Headless FFmpeg Filtergraph Generator', () => {
  const sampleAst: TimelineAST = {
    version: 1,
    id: 'nle-ast-sample',
    timebase: 60000,
    dimensions: { width: 1920, height: 1080 },
    audioFormat: { sampleRate: 48000, channels: 2 },
    tracks: [
      {
        id: 'v1',
        type: 'video',
        index: 0,
        muted: false,
        locked: false,
        clips: [
          {
            id: 'clip_v1',
            assetId: '/assets/sample1.mp4',
            type: 'video',
            speed: 1.0,
            timelineRange: {
              start: { pts: 0n, timescale: 60000 },
              duration: { pts: 120000n, timescale: 60000 }, // 2s
            },
            sourceRange: {
              start: { pts: 30000n, timescale: 60000 }, // 0.5s trim start
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
          },
        ],
      },
      {
        id: 'a1',
        type: 'audio',
        index: 1,
        muted: false,
        locked: false,
        clips: [
          {
            id: 'clip_a1',
            assetId: '/assets/sample1.mp4', // Reusing same asset to test input dedup
            type: 'audio',
            speed: 1.0,
            gain: 0.8,
            pan: 0,
            busAssignment: 'master',
            timelineRange: {
              start: { pts: 0n, timescale: 60000 },
              duration: { pts: 120000n, timescale: 60000 },
            },
            sourceRange: {
              start: { pts: 30000n, timescale: 60000 },
              duration: { pts: 120000n, timescale: 60000 },
            },
          },
        ],
      },
    ],
  };

  it('generates deterministic FFmpeg CLI command with deduplicated inputs', () => {
    const cmd = compileFfmpegCommand(sampleAst, '/tmp/output.mp4');

    // Only one -i flag should be present for sample1.mp4
    const inputMatches = cmd.match(/-i "\/assets\/sample1\.mp4"/g);
    expect(inputMatches).toHaveLength(1);

    // Verify filter graph components
    expect(cmd).toContain('color=c=black:s=1920x1080');
    expect(cmd).toContain('trim=start=0.5:duration=2');
    expect(cmd).toContain('scale=1920:-1');
    expect(cmd).toContain('overlay=enable=\'between(t,0,2)\':x=0:y=0');
    expect(cmd).toContain('atrim=start=0.5:duration=2');
    expect(cmd).toContain('volume=0.8');
    expect(cmd).toContain('amix=inputs=1:normalize=0');
    expect(cmd).toContain('-map "[canvas_pass_0]"');
    expect(cmd).toContain('-map "[out_a]"');
    expect(cmd).toContain('-c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -c:a aac -b:a 320k "/tmp/output.mp4"');
  });

  it('omits clips on muted tracks and falls back to anullsrc if no audio', () => {
    const videoOnlyAst: TimelineAST = {
      ...sampleAst,
      tracks: [
        sampleAst.tracks[0], // video track active
        { ...sampleAst.tracks[1], muted: true }, // audio muted
      ],
    };

    const cmd = compileFfmpegCommand(videoOnlyAst, '/tmp/muted.mp4');
    expect(cmd).toContain('anullsrc=channel_layout=stereo:sample_rate=48000[out_a]');
    expect(cmd).not.toContain('volume=0.8');
  });

  it('respects custom compiler options', () => {
    const cmd = compileFfmpegCommand(sampleAst, '/tmp/custom.mp4', {
      crf: 23,
      preset: 'fast',
      audioBitrate: '192k',
      pixelFormat: 'yuv422p',
    });

    expect(cmd).toContain('-crf 23');
    expect(cmd).toContain('-preset fast');
    expect(cmd).toContain('-b:a 192k');
    expect(cmd).toContain('-pix_fmt yuv422p');
  });
});
