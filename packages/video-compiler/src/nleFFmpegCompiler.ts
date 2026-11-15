/**
 * Headless FFmpeg Filtergraph Generator for Open-Source NLE Engine (Issue #413).
 *
 * Translates an immutable TimelineAST into a production-grade FFmpeg CLI command
 * for headless background render workers or native Electron environments.
 */

import { ptsToSeconds } from './nleTimelineMath.js';
import type { TimelineAST, VideoClip, AudioClip } from '@indii/shared';

export interface FFmpegCompilerOptions {
  crf?: number;
  preset?: string;
  audioBitrate?: string;
  pixelFormat?: string;
}

/**
 * Compiles a TimelineAST into a deterministic, headless FFmpeg CLI command string.
 */
export function compileFfmpegCommand(
  ast: TimelineAST,
  outputFilePath: string,
  options: FFmpegCompilerOptions = {}
): string {
  const crf = options.crf ?? 18;
  const preset = options.preset ?? 'medium';
  const audioBitrate = options.audioBitrate ?? '320k';
  const pixelFormat = options.pixelFormat ?? 'yuv420p';

  const inputs: string[] = [];
  const filterChains: string[] = [];
  const inputIndices: Map<string, number> = new Map();

  let inputCounter = 0;

  // 1. Collect unique source media assets as -i CLI inputs
  for (const track of ast.tracks) {
    for (const clip of track.clips) {
      if (!inputIndices.has(clip.assetId)) {
        inputs.push(`-i "${clip.assetId}"`);
        inputIndices.set(clip.assetId, inputCounter);
        inputCounter++;
      }
    }
  }

  // Calculate total timeline duration in seconds to bound base canvas
  let maxEndSeconds = 0;
  for (const track of ast.tracks) {
    for (const clip of track.clips) {
      const endSeconds = ptsToSeconds(clip.timelineRange.start) + ptsToSeconds(clip.timelineRange.duration);
      if (endSeconds > maxEndSeconds) {
        maxEndSeconds = endSeconds;
      }
    }
  }
  const totalDurationSeconds = maxEndSeconds > 0 ? maxEndSeconds : 60;

  // 2. Base canvas setup
  const baseCanvas = `color=c=black:s=${ast.dimensions.width}x${ast.dimensions.height}:r=60:d=${totalDurationSeconds}[base]`;
  filterChains.push(baseCanvas);

  let currentVideoOutput = 'base';
  let vOverlayCount = 0;

  // 3. Process Video Tracks
  const videoTracks = ast.tracks.filter((t) => t.type === 'video' && !t.muted);
  for (const track of videoTracks) {
    for (const clip of track.clips as VideoClip[]) {
      const inIdx = inputIndices.get(clip.assetId);
      if (inIdx === undefined) continue;

      const trimStart = ptsToSeconds(clip.sourceRange.start);
      const trimDur = ptsToSeconds(clip.sourceRange.duration);
      const targetStart = ptsToSeconds(clip.timelineRange.start);
      const targetEnd = targetStart + ptsToSeconds(clip.timelineRange.duration);

      const clipLabel = `v_${clip.id}`;
      const scaledLabel = `scaled_${clip.id}`;
      const nextOutput = `canvas_pass_${vOverlayCount++}`;

      // Trim -> Scale -> Position Overlay
      filterChains.push(
        `[${inIdx}:v]trim=start=${trimStart}:duration=${trimDur},setpts=(PTS-STARTPTS)/${clip.speed}+${targetStart}/TB[${clipLabel}]`
      );
      filterChains.push(
        `[${clipLabel}]scale=${ast.dimensions.width}:-1[${scaledLabel}]`
      );
      filterChains.push(
        `[${currentVideoOutput}][${scaledLabel}]overlay=eof_action=repeat:enable='gte(t,${targetStart})*lt(t,${targetEnd})':x=0:y=0[${nextOutput}]`
      );

      currentVideoOutput = nextOutput;
    }
  }

  // 4. Process Audio Tracks
  const audioTracks = ast.tracks.filter((t) => t.type === 'audio' && !t.muted);
  const audioLabels: string[] = [];

  for (const track of audioTracks) {
    for (const clip of track.clips as AudioClip[]) {
      const inIdx = inputIndices.get(clip.assetId);
      if (inIdx === undefined) continue;

      const trimStart = ptsToSeconds(clip.sourceRange.start);
      const trimDur = ptsToSeconds(clip.sourceRange.duration);
      const clipDuration = ptsToSeconds(clip.timelineRange.duration);
      const delaySamples = Math.round(ptsToSeconds(clip.timelineRange.start) * 48000);
      const aLabel = `a_${clip.id}`;

      filterChains.push(
        `[${inIdx}:a]atrim=start=${trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,atempo=${Math.sqrt(clip.speed)},atempo=${Math.sqrt(clip.speed)},aresample=48000,apad,atrim=duration=${clipDuration},adelay=${delaySamples}S:all=1,asetpts=N/SR/TB,volume=${clip.gain}[${aLabel}]`
      );
      audioLabels.push(`[${aLabel}]`);
    }
  }

  // Mix all audio streams
  const finalAudioOutput = 'out_a';
  if (audioLabels.length > 0) {
    filterChains.push(
      `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0,apad[${finalAudioOutput}]`
    );
  } else {
    filterChains.push(`anullsrc=channel_layout=stereo:sample_rate=48000[${finalAudioOutput}]`);
  }

  // 5. Final CLI assembly
  const filterGraph = filterChains.join('; ');
  return `ffmpeg -y ${inputs.join(' ')} -filter_complex "${filterGraph}" -map "[${currentVideoOutput}]" -map "[${finalAudioOutput}]" -c:v libx264 -pix_fmt ${pixelFormat} -preset ${preset} -crf ${crf} -c:a aac -b:a ${audioBitrate} -t ${totalDurationSeconds} "${outputFilePath}"`;
}
