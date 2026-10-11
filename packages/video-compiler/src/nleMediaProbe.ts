import type { MediaMetadata } from '@indii/shared';

/**
 * Raw ffprobe stream payload structure.
 */
export interface FfprobeRawStream {
  codec_type?: 'video' | 'audio' | string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_space?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string | number;
  channels?: number;
  channel_layout?: string;
  duration?: string | number;
}

/**
 * Raw ffprobe frame entry payload structure.
 */
export interface FfprobeRawFrame {
  key_frame?: number;
  pkt_pts?: string | number;
  pkt_pts_time?: string | number;
}

/**
 * Comprehensive probe analysis result.
 */
export interface MediaProbeResult {
  isVFR: boolean;
  avgFps: number;
  nominalFps: number;
  needsCfrTranscode: boolean;
  cfrTranscodeCommand?: string;
  needsAudioNormalization: boolean;
  audioNormalizationCommand?: string;
  keyframePtsList: bigint[];
  metadata: MediaMetadata;
}

/**
 * Parses rational frame rate string (e.g. "30000/1001", "30/1") into numbers.
 */
export function parseRationalRate(rateStr?: string): { num: number; den: number; fps: number } {
  if (!rateStr || typeof rateStr !== 'string') {
    return { num: 0, den: 1, fps: 0 };
  }

  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = Number.parseInt(parts[0], 10);
    const den = Number.parseInt(parts[1], 10);
    if (!Number.isNaN(num) && !Number.isNaN(den) && den > 0) {
      return { num, den, fps: num / den };
    }
  } else if (parts.length === 1) {
    const num = Number.parseFloat(parts[0]);
    if (!Number.isNaN(num)) {
      return { num: Math.round(num * 1000), den: 1000, fps: num };
    }
  }

  return { num: 0, den: 1, fps: 0 };
}

/**
 * Detects Variable Frame Rate (VFR) by comparing avg_frame_rate and r_frame_rate.
 * Returns true if the rates diverge by more than the tolerance threshold.
 */
export function detectVFR(
  avgRateStr?: string,
  rRateStr?: string,
  tolerance = 0.005
): { isVFR: boolean; avgFps: number; nominalFps: number } {
  const avg = parseRationalRate(avgRateStr);
  const nominal = parseRationalRate(rRateStr);

  if (avg.fps <= 0 || nominal.fps <= 0) {
    return { isVFR: false, avgFps: avg.fps, nominalFps: nominal.fps };
  }

  const deviation = Math.abs(avg.fps - nominal.fps) / nominal.fps;
  const isVFR = deviation > tolerance;

  return {
    isVFR,
    avgFps: avg.fps,
    nominalFps: nominal.fps,
  };
}

/**
 * Generates deterministic FFmpeg background command for Constant Frame Rate (CFR) transcode.
 */
export function generateCfrTranscodeCommand(
  inputPath: string,
  outputPath: string,
  targetFps = 60,
  preset = 'ultrafast',
  crf = 18
): string {
  return `ffmpeg -y -i "${inputPath}" -fps_mode cfr -r ${targetFps} -c:v libx264 -preset ${preset} -crf ${crf} -c:a copy "${outputPath}"`;
}

/**
 * Generates deterministic FFmpeg audio normalization command (48 kHz 24-bit PCM).
 */
export function generateAudioNormalizeCommand(
  inputPath: string,
  outputPath: string,
  sampleRate = 48000,
  codec = 'pcm_s24le'
): string {
  return `ffmpeg -y -i "${inputPath}" -vn -ar ${sampleRate} -c:a ${codec} "${outputPath}"`;
}

/**
 * Extracts presentation timestamps (in integer PTS or microseconds) for all keyframes (IDR/I-frames).
 */
export function extractKeyframePts(frames: FfprobeRawFrame[]): bigint[] {
  const keyframePtsList: bigint[] = [];

  for (const frame of frames) {
    if (frame.key_frame === 1 && frame.pkt_pts !== undefined) {
      try {
        const pts = BigInt(frame.pkt_pts);
        keyframePtsList.push(pts);
      } catch {
        // Skip unparseable PTS entries
      }
    }
  }

  return keyframePtsList.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Binary search to find closest preceding keyframe PTS to achieve < 80ms instant seek.
 */
export function findClosestKeyframePts(keyframePtsList: bigint[], targetPts: bigint): bigint {
  if (keyframePtsList.length === 0) return 0n;
  if (targetPts <= keyframePtsList[0]) return keyframePtsList[0];
  if (targetPts >= keyframePtsList[keyframePtsList.length - 1]) {
    return keyframePtsList[keyframePtsList.length - 1];
  }

  let low = 0;
  let high = keyframePtsList.length - 1;
  let result = keyframePtsList[0];

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midPts = keyframePtsList[mid];

    if (midPts === targetPts) {
      return midPts;
    }

    if (midPts < targetPts) {
      result = midPts; // Candidate preceding keyframe
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Analyzes ffprobe output to build MediaProbeResult and validate against NLE requirements.
 */
export function analyzeMediaProbe(
  probeData: {
    streams: FfprobeRawStream[];
    frames?: FfprobeRawFrame[];
  },
  sourceUri: string,
  id: string,
  hashSha256 = ''
): MediaProbeResult {
  const videoStream = probeData.streams.find((s) => s.codec_type === 'video');
  const audioStream = probeData.streams.find((s) => s.codec_type === 'audio');

  const frames = probeData.frames || [];
  const keyframePtsList = extractKeyframePts(frames);

  // VFR analysis
  const vfrAnalysis = videoStream
    ? detectVFR(videoStream.avg_frame_rate, videoStream.r_frame_rate)
    : { isVFR: false, avgFps: 0, nominalFps: 0 };

  const needsCfrTranscode = vfrAnalysis.isVFR;
  const cfrTranscodeCommand = needsCfrTranscode
    ? generateCfrTranscodeCommand(sourceUri, sourceUri.replace(/(\.[^.]+)$/, '_cfr$1'))
    : undefined;

  // Audio sample rate analysis (Project clock is strictly 48000 Hz)
  const incomingSampleRate = audioStream?.sample_rate
    ? Number.parseInt(String(audioStream.sample_rate), 10)
    : 48000;
  const needsAudioNormalization = audioStream !== undefined && incomingSampleRate !== 48000;
  const audioNormalizationCommand = needsAudioNormalization
    ? generateAudioNormalizeCommand(sourceUri, sourceUri.replace(/(\.[^.]+)$/, '_48k.wav'))
    : undefined;

  type VideoCodec = NonNullable<MediaMetadata['video']>['codec'];
  type AudioCodec = NonNullable<MediaMetadata['audio']>['codec'];

  // Map Codec strings safely
  const mapVideoCodec = (rawCodec?: string): VideoCodec => {
    switch (rawCodec?.toLowerCase()) {
      case 'h264':
      case 'avc1':
        return 'h264';
      case 'hevc':
      case 'h265':
        return 'h265';
      case 'vp9':
        return 'vp9';
      case 'av1':
        return 'av1';
      case 'prores':
        return 'prores';
      default:
        return 'h264';
    }
  };

  const mapAudioCodec = (rawCodec?: string): AudioCodec => {
    switch (rawCodec?.toLowerCase()) {
      case 'aac':
        return 'aac';
      case 'pcm_s16le':
        return 'pcm_s16le';
      case 'pcm_s24le':
        return 'pcm_s24le';
      case 'pcm_f32le':
        return 'pcm_f32le';
      case 'opus':
        return 'opus';
      default:
        return 'aac';
    }
  };

  const durationUs = videoStream?.duration
    ? Math.round(Number.parseFloat(String(videoStream.duration)) * 1_000_000)
    : audioStream?.duration
      ? Math.round(Number.parseFloat(String(audioStream.duration)) * 1_000_000)
      : 0;

  const metadata: MediaMetadata = {
    id,
    sourceUri,
    hashSha256,
    format: videoStream ? 'mp4' : 'wav',
    durationUs,
    video: videoStream
      ? {
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          codec: mapVideoCodec(videoStream.codec_name),
          pixFmt: videoStream.pix_fmt || 'yuv420p',
          colorSpace: videoStream.color_space || 'bt709',
          isVFR: vfrAnalysis.isVFR,
          frameRate: {
            num: parseRationalRate(videoStream.r_frame_rate).num || 60,
            den: parseRationalRate(videoStream.r_frame_rate).den || 1,
          },
          keyframeIndices: keyframePtsList.map((pts) => Number(pts)),
        }
      : undefined,
    audio: audioStream
      ? {
          codec: mapAudioCodec(audioStream.codec_name),
          sampleRate: incomingSampleRate,
          channels: audioStream.channels || 2,
          channelLayout: audioStream.channels === 1 ? 'mono' : 'stereo',
        }
      : undefined,
  };

  return {
    isVFR: vfrAnalysis.isVFR,
    avgFps: vfrAnalysis.avgFps,
    nominalFps: vfrAnalysis.nominalFps,
    needsCfrTranscode,
    cfrTranscodeCommand,
    needsAudioNormalization,
    audioNormalizationCommand,
    keyframePtsList,
    metadata,
  };
}
