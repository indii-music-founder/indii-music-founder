import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NLEMediaProbeService } from './NLEMediaProbeService';
import type { FfprobeRawStream, FfprobeRawFrame } from '@indii/video-compiler';

describe('NLEMediaProbeService (Renderer Client Service)', () => {
  beforeEach(() => {
    NLEMediaProbeService.clearCache();
  });

  it('probes asset via native probe function and caches results', async () => {
    const mockStreams: FfprobeRawStream[] = [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        avg_frame_rate: '30/1',
        r_frame_rate: '30/1',
        duration: '10.0',
      },
      {
        codec_type: 'audio',
        codec_name: 'aac',
        sample_rate: 48000,
        channels: 2,
        duration: '10.0',
      },
    ];

    const mockFrames: FfprobeRawFrame[] = [
      { key_frame: 1, pkt_pts: 0 },
      { key_frame: 1, pkt_pts: 60000 },
      { key_frame: 1, pkt_pts: 120000 },
    ];

    const probeSpy = vi.fn().mockResolvedValue({ streams: mockStreams, frames: mockFrames });

    const result = await NLEMediaProbeService.probeAsset({
      sourceUri: 'file:///assets/clip1.mp4',
      assetId: 'asset-clip1',
      nativeProbeFn: probeSpy,
    });

    expect(probeSpy).toHaveBeenCalledTimes(1);
    expect(result.isVFR).toBe(false);
    expect(result.needsCfrTranscode).toBe(false);
    expect(result.metadata.video?.width).toBe(1920);
    expect(result.keyframePtsList).toEqual([0n, 60000n, 120000n]);

    // Second call should return cached result without invoking probe function
    const cached = await NLEMediaProbeService.probeAsset({
      sourceUri: 'file:///assets/clip1.mp4',
      assetId: 'asset-clip1',
      nativeProbeFn: probeSpy,
    });

    expect(probeSpy).toHaveBeenCalledTimes(1);
    expect(cached).toBe(result);
  });

  it('determines instant seek keyframe accurately from cached probe', async () => {
    const mockFrames: FfprobeRawFrame[] = [
      { key_frame: 1, pkt_pts: 0 },
      { key_frame: 1, pkt_pts: 60000 },
      { key_frame: 1, pkt_pts: 120000 },
    ];

    await NLEMediaProbeService.probeAsset({
      sourceUri: 'file:///assets/clip2.mp4',
      assetId: 'asset-clip2',
      nativeProbeFn: async () => ({
        streams: [{ codec_type: 'video', avg_frame_rate: '60/1', r_frame_rate: '60/1' }],
        frames: mockFrames,
      }),
    });

    // Seek to PTS 85000 should snap back to keyframe 60000 for decoding
    const seekPts = NLEMediaProbeService.getSeekKeyframePts('asset-clip2', 85000n);
    expect(seekPts).toBe(60000n);
  });

  it('uses browser fallback when no native probe is provided', async () => {
    const result = await NLEMediaProbeService.probeAsset({
      sourceUri: 'https://cdn.indii.music/sample.mp4',
      assetId: 'asset-web-fallback',
    });

    expect(result.metadata.video?.width).toBe(1920);
    expect(result.metadata.audio?.sampleRate).toBe(48000);
    expect(result.isVFR).toBe(false);
  });

  it('probes asset via window.electronAPI.video.probeMedia when available', async () => {
    const electronProbeSpy = vi.fn().mockResolvedValue({
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 3840,
          height: 2160,
          avg_frame_rate: '24/1',
          r_frame_rate: '24/1',
        },
      ],
      frames: [{ key_frame: 1, pkt_pts: 0 }],
    });

    (window as unknown as { electronAPI?: { video?: { probeMedia?: typeof electronProbeSpy } } }).electronAPI = {
      video: {
        probeMedia: electronProbeSpy,
      },
    };

    const result = await NLEMediaProbeService.probeAsset({
      sourceUri: '/local/4k_clip.mp4',
      assetId: 'asset-4k',
    });

    expect(electronProbeSpy).toHaveBeenCalledWith('/local/4k_clip.mp4');
    expect(result.metadata.video?.width).toBe(3840);
    expect(result.metadata.video?.height).toBe(2160);

    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });
});
