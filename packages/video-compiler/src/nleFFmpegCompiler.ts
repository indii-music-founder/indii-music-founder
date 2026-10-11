/**
 * Headless FFmpeg Filtergraph Generator for Open-Source NLE Engine (Issue #413).
 *
 * Translates an immutable TimelineAST into a production-grade FFmpeg CLI command
 * for headless background render workers or native Electron environments.
 */

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
  let maxEndPts = 0n;
  for (const track of ast.tracks) {
    for (const clip of track.clips) {
      const endPts = clip.timelineRange.start.pts + clip.timelineRange.duration.pts;
      if (endPts > maxEndPts) {
        maxEndPts = endPts;
      }
    }
  }
  const totalDurationSeconds = maxEndPts > 0n ? Math.ceil(Number(maxEndPts) / ast.timebase) : 60;

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

      const trimStart = Number(clip.sourceRange.start.pts) / ast.timebase;
      const trimDur = Number(clip.timelineRange.duration.pts) / ast.timebase;
      const targetStart = Number(clip.timelineRange.start.pts) / ast.timebase;

      const clipLabel = `v_${clip.id}`;
      const scaledLabel = `scaled_${clip.id}`;
      const nextOutput = `canvas_pass_${vOverlayCount++}`;

      // Trim -> Scale -> Position Overlay
      filterChains.push(
        `[${inIdx}:v]trim=start=${trimStart}:duration=${trimDur},setpts=PTS-STARTPTS[${clipLabel}]`
      );
      filterChains.push(
        `[${clipLabel}]scale=${ast.dimensions.width}:-1[${scaledLabel}]`
      );
      filterChains.push(
        `[${currentVideoOutput}][${scaledLabel}]overlay=enable='between(t,${targetStart},${targetStart + trimDur})':x=0:y=0[${nextOutput}]`
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

      const trimStart = Number(clip.sourceRange.start.pts) / ast.timebase;
      const trimDur = Number(clip.timelineRange.duration.pts) / ast.timebase;
      const delayMs = Math.round((Number(clip.timelineRange.start.pts) / ast.timebase) * 1000);
      const aLabel = `a_${clip.id}`;

      filterChains.push(
        `[${inIdx}:a]atrim=start=${trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},aresample=48000,volume=${clip.gain}[${aLabel}]`
      );
      audioLabels.push(`[${aLabel}]`);
    }
  }

  // Mix all audio streams
  const finalAudioOutput = 'out_a';
  if (audioLabels.length > 0) {
    filterChains.push(
      `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0[${finalAudioOutput}]`
    );
  } else {
    filterChains.push(`anullsrc=channel_layout=stereo:sample_rate=48000[${finalAudioOutput}]`);
  }

  // 5. Final CLI assembly
  const filterGraph = filterChains.join('; ');
  return `ffmpeg -y ${inputs.join(' ')} -filter_complex "${filterGraph}" -map "[${currentVideoOutput}]" -map "[${finalAudioOutput}]" -c:v libx264 -pix_fmt ${pixelFormat} -preset ${preset} -crf ${crf} -c:a aac -b:a ${audioBitrate} "${outputFilePath}"`;
}
