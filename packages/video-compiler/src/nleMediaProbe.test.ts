import { describe, it, expect } from 'vitest';
import {
  parseRationalRate,
  detectVFR,
  generateCfrTranscodeCommand,
  generateAudioNormalizeCommand,
  extractKeyframePts,
  findClosestKeyframePts,
  analyzeMediaProbe,
  type FfprobeRawStream,
  type FfprobeRawFrame,
} from './nleMediaProbe.js';

describe('NLE Ingestion Probe & Pre-Flight Normalization (Issue #413)', () => {
  describe('parseRationalRate', () => {
    it('parses standard integer ratios', () => {
      expect(parseRationalRate('30/1')).toEqual({ num: 30, den: 1, fps: 30 });
      expect(parseRationalRate('60/1')).toEqual({ num: 60, den: 1, fps: 60 });
    });

    it('parses NTSC drop-frame rates', () => {
      const ntsc30 = parseRationalRate('30000/1001');
      expect(ntsc30.num).toBe(30000);
      expect(ntsc30.den).toBe(1001);
      expect(ntsc30.fps).toBeCloseTo(29.97003, 4);

      const ntsc24 = parseRationalRate('24000/1001');
      expect(ntsc24.num).toBe(24000);
      expect(ntsc24.den).toBe(1001);
      expect(ntsc24.fps).toBeCloseTo(23.97602, 4);
    });

    it('handles empty or malformed strings gracefully', () => {
      expect(parseRationalRate(undefined)).toEqual({ num: 0, den: 1, fps: 0 });
      expect(parseRationalRate('0/0')).toEqual({ num: 0, den: 1, fps: 0 });
      expect(parseRationalRate('invalid')).toEqual({ num: 0, den: 1, fps: 0 });
    });
  });

  describe('detectVFR', () => {
    it('identifies CFR streams where rates match', () => {
      const result = detectVFR('60/1', '60/1');
      expect(result.isVFR).toBe(false);
      expect(result.avgFps).toBe(60);
      expect(result.nominalFps).toBe(60);
    });

    it('identifies VFR streams from mobile cameras with fluctuating frame rates', () => {
      // e.g. Phone recorded video with nominal 30fps but average 27.4fps
      const result = detectVFR('27400/1000', '30000/1001');
      expect(result.isVFR).toBe(true);
      expect(result.avgFps).toBe(27.4);
      expect(result.nominalFps).toBeCloseTo(29.97, 2);
    });

    it('respects tolerance threshold for minor timing jitter', () => {
      // 29.970 vs 29.971 is < 0.5% deviation
      const result = detectVFR('29971/1000', '30000/1001', 0.005);
      expect(result.isVFR).toBe(false);
    });
  });

  describe('FFmpeg Command Generators', () => {
    it('generates deterministic CFR 60fps transcode command', () => {
      const cmd = generateCfrTranscodeCommand('input_vfr.mp4', 'output_cfr.mp4', 60);
      expect(cmd).toBe(
        'ffmpeg -y -i "input_vfr.mp4" -fps_mode cfr -r 60 -c:v libx264 -preset ultrafast -crf 18 -c:a copy "output_cfr.mp4"'
      );
    });

    it('generates 48 kHz PCM audio normalization command', () => {
      const cmd = generateAudioNormalizeCommand('input_44k.mp4', 'cached_audio_48k.wav', 48000);
      expect(cmd).toBe(
        'ffmpeg -y -i "input_44k.mp4" -vn -ar 48000 -c:a pcm_s24le "cached_audio_48k.wav"'
      );
    });
  });

  describe('Keyframe Indexing & Seeking Optimization (<80ms target)', () => {
    const sampleFrames: FfprobeRawFrame[] = [
      { key_frame: 1, pkt_pts: 0 },
      { key_frame: 0, pkt_pts: 2000 },
      { key_frame: 0, pkt_pts: 4000 },
      { key_frame: 1, pkt_pts: 60000 },
      { key_frame: 0, pkt_pts: 62000 },
      { key_frame: 1, pkt_pts: 120000 },
    ];

    it('extracts sorted keyframe PTS list', () => {
      const keyframes = extractKeyframePts(sampleFrames);
      expect(keyframes).toEqual([0n, 60000n, 120000n]);
    });

    it('finds closest preceding keyframe PTS via binary search', () => {
      const keyframes = [0n, 60000n, 120000n, 180000n];

      // Exact hit
      expect(findClosestKeyframePts(keyframes, 60000n)).toBe(60000n);

      // Between keyframes (should snap to preceding keyframe for decoding)
      expect(findClosestKeyframePts(keyframes, 75000n)).toBe(60000n);
      expect(findClosestKeyframePts(keyframes, 150000n)).toBe(120000n);

      // Before first keyframe
      expect(findClosestKeyframePts(keyframes, 0n)).toBe(0n);

      // After last keyframe
      expect(findClosestKeyframePts(keyframes, 250000n)).toBe(180000n);
    });
  });

  describe('analyzeMediaProbe', () => {
    it('detects VFR and non-48k audio, recommending necessary transcode jobs', () => {
      const streams: FfprobeRawStream[] = [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          avg_frame_rate: '24123/1000', // 24.123 fps
          r_frame_rate: '30/1',         // 30 fps nominal -> VFR!
          duration: '12.5',
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
          sample_rate: 44100,           // Non-48k!
          channels: 2,
          duration: '12.5',
        },
      ];

      const frames: FfprobeRawFrame[] = [
        { key_frame: 1, pkt_pts: '0' },
        { key_frame: 1, pkt_pts: '60000' },
      ];

      const result = analyzeMediaProbe({ streams, frames }, '/path/to/media.mp4', 'asset-1');

      expect(result.isVFR).toBe(true);
      expect(result.needsCfrTranscode).toBe(true);
      expect(result.cfrTranscodeCommand).toContain('-fps_mode cfr -r 60');

      expect(result.needsAudioNormalization).toBe(true);
      expect(result.audioNormalizationCommand).toContain('-ar 48000 -c:a pcm_s24le');

      expect(result.keyframePtsList).toEqual([0n, 60000n]);
      expect(result.metadata.video?.isVFR).toBe(true);
      expect(result.metadata.video?.keyframeIndices).toEqual([0, 60000]);
      expect(result.metadata.audio?.sampleRate).toBe(44100);
    });

    it('passes clean CFR 60fps 48k streams with no transcode needed', () => {
      const streams: FfprobeRawStream[] = [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 3840,
          height: 2160,
          avg_frame_rate: '60/1',
          r_frame_rate: '60/1',
          duration: '60.0',
        },
        {
          codec_type: 'audio',
          codec_name: 'pcm_s24le',
          sample_rate: 48000,
          channels: 2,
          duration: '60.0',
        },
      ];

      const result = analyzeMediaProbe({ streams }, '/path/to/clean.mp4', 'asset-clean');

      expect(result.isVFR).toBe(false);
      expect(result.needsCfrTranscode).toBe(false);
      expect(result.cfrTranscodeCommand).toBeUndefined();

      expect(result.needsAudioNormalization).toBe(false);
      expect(result.audioNormalizationCommand).toBeUndefined();
    });
  });
});
