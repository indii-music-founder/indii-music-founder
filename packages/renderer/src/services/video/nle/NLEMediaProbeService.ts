import {
  analyzeMediaProbe,
  findClosestKeyframePts,
  type MediaProbeResult,
  type FfprobeRawStream,
  type FfprobeRawFrame,
} from '@indii/video-compiler';
import { logger } from '@/utils/logger';

export interface ProbeOptions {
  sourceUri: string;
  assetId: string;
  hashSha256?: string;
  nativeProbeFn?: (uri: string) => Promise<{ streams: FfprobeRawStream[]; frames?: FfprobeRawFrame[] }>;
}

/**
 * Client-side NLE Media Ingestion & Pre-Flight Probe Service (Issue #413 Section 3).
 *
 * Coordinates stream inspection, VFR detection, audio 48kHz verification,
 * and keyframe PTS caching for <80ms seek latency.
 */
export class NLEMediaProbeService {
  private static probeCache: Map<string, MediaProbeResult> = new Map();

  /**
   * Ingests and inspects media file before adding to the timeline.
   */
  public static async probeAsset(options: ProbeOptions): Promise<MediaProbeResult> {
    const { sourceUri, assetId, hashSha256 = '', nativeProbeFn } = options;

    if (this.probeCache.has(assetId)) {
      return this.probeCache.get(assetId)!;
    }

    logger.info(`[NLEMediaProbeService] Ingesting & probing asset "${assetId}" from "${sourceUri}"`);

    let rawProbeData: { streams: FfprobeRawStream[]; frames?: FfprobeRawFrame[] };

    if (nativeProbeFn) {
      rawProbeData = await nativeProbeFn(sourceUri);
    } else if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { probeMedia?: (uri: string) => Promise<unknown> } }).electronAPI?.probeMedia) {
      rawProbeData = (await (window as unknown as { electronAPI: { probeMedia: (uri: string) => Promise<{ streams: FfprobeRawStream[]; frames?: FfprobeRawFrame[] }> } }).electronAPI.probeMedia(sourceUri));
    } else {
      // Browser fallback probe (Standard 60fps CFR default when native ffprobe unavailable)
      rawProbeData = {
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            avg_frame_rate: '60/1',
            r_frame_rate: '60/1',
            duration: 0,
          },
          {
            codec_type: 'audio',
            codec_name: 'aac',
            sample_rate: 48000,
            channels: 2,
            duration: 0,
          },
        ],
        frames: [{ key_frame: 1, pkt_pts: 0 }],
      };
    }

    const result = analyzeMediaProbe(rawProbeData, sourceUri, assetId, hashSha256);

    if (result.isVFR) {
      logger.warn(
        `[NLEMediaProbeService] Asset "${assetId}" is VFR (avg: ${result.avgFps.toFixed(2)}fps, nominal: ${result.nominalFps.toFixed(2)}fps). Transcode recommended for zero frame-drop scrubbing.`
      );
    }

    if (result.needsAudioNormalization) {
      logger.warn(
        `[NLEMediaProbeService] Asset "${assetId}" audio rate (${result.metadata.audio?.sampleRate}Hz) diverges from project clock (48000Hz). Normalization recommended.`
      );
    }

    this.probeCache.set(assetId, result);
    return result;
  }

  /**
   * Fast seek target calculation for instant (<80ms) keyframe navigation.
   */
  public static getSeekKeyframePts(assetId: string, targetPts: bigint): bigint {
    const probe = this.probeCache.get(assetId);
    if (!probe || probe.keyframePtsList.length === 0) {
      return targetPts;
    }
    return findClosestKeyframePts(probe.keyframePtsList, targetPts);
  }

  /**
   * Clears probe cache when timeline or project is disposed.
   */
  public static clearCache(): void {
    this.probeCache.clear();
  }
}
