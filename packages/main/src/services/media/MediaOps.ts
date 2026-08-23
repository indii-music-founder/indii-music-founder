/**
 * MediaOps — the DIRECT MEDIA fast path (MIG-003, ADR-001).
 *
 * Deterministic FFmpeg operations that must never enter a browser/composition
 * engine: probe, µs-precision trim, transcode/rescale, audio replacement and
 * normalization, thumbnail extraction. The RenderPlanner (MIG-004) routes here.
 *
 * All functions are pure-with-explicit-paths (binaries injectable for tests)
 * and fail closed: non-zero exits reject with the tail of stderr.
 */

import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export interface MediaBinaries {
    ffmpeg: string;
    ffprobe: string;
}

export const defaultBins = (): MediaBinaries => ({
    // Packages type these as string | null; empty/null fails closed at run time.
    ffmpeg: (ffmpegPath as unknown as string) || 'ffmpeg',
    ffprobe: ((ffprobePath as unknown as { path: string }).path) || 'ffprobe',
});

export interface ProbeSummary {
    durationUs: number;
    width?: number;
    height?: number;
    fps?: number;
    hasVideo: boolean;
    hasAudio: boolean;
    videoDurationUs?: number;
    audioDurationUs?: number;
    videoCodec?: string;
    audioCodec?: string;
}

interface FfprobeStream {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
}

interface FfprobeJson {
    streams?: FfprobeStream[];
    format?: { duration?: string };
}

const runBin = (
    bin: string,
    args: string[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`${path.basename(bin)} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.stderr.on('data', chunk => {
            stderr += String(chunk);
            if (stderr.length > 16_000) stderr = stderr.slice(-8_000);
        });
        child.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.trim().slice(-800)}`));
        });
    });

/** Parse rational frame rates like "30000/1001". */
const parseFps = (rational?: string): number | undefined => {
    if (!rational) return undefined;
    const [num, den] = rational.split('/').map(Number);
    if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return undefined;
    return Math.round((num / den) * 1000) / 1000;
};

export const probeMedia = async (
    input: string,
    bins: MediaBinaries = defaultBins(),
): Promise<ProbeSummary> =>
    new Promise((resolve, reject) => {
        const child = spawn(
            bins.ffprobe,
            ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += String(chunk); });
        child.stderr.on('data', chunk => { stderr += String(chunk); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) {
                reject(new Error(`ffprobe exited ${code}: ${stderr.trim().slice(-400)}`));
                return;
            }
            try {
                const parsed = JSON.parse(stdout) as FfprobeJson;
                const streams = parsed.streams ?? [];
                const video = streams.find(s => s.codec_type === 'video');
                const audio = streams.find(s => s.codec_type === 'audio');
                const durationSec = Number(parsed.format?.duration ?? '0');
                const streamDurationUs = (stream: FfprobeStream | undefined): number | undefined => {
                    const seconds = Number(stream?.duration);
                    return Number.isFinite(seconds) && seconds >= 0
                        ? Math.round(seconds * 1_000_000)
                        : undefined;
                };
                resolve({
                    durationUs: Math.round(durationSec * 1_000_000),
                    width: video?.width,
                    height: video?.height,
                    fps: parseFps(video?.r_frame_rate),
                    hasVideo: Boolean(video),
                    hasAudio: Boolean(audio),
                    videoDurationUs: streamDurationUs(video),
                    audioDurationUs: streamDurationUs(audio),
                    videoCodec: video?.codec_name,
                    audioCodec: audio?.codec_name,
                });
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    });

export interface TrimSpanRequest {
    input: string;
    output: string;
    /** Inclusive span start in microseconds. */
    startUs: number;
    /** Exclusive span end in microseconds (> startUs). */
    endUs: number;
    bins?: MediaBinaries;
}

/** Cut [startUs, endUs) without re-encoding when possible (stream copy at keyframe snap). */
export const trimToSpan = async ({
    input, output, startUs, endUs, bins = defaultBins(),
}: TrimSpanRequest): Promise<void> => {
    if (!Number.isFinite(startUs) || !Number.isFinite(endUs) || endUs <= startUs || startUs < 0) {
        throw new Error(`trimToSpan: invalid span ${startUs}..${endUs}µs`);
    }
    await runBin(bins.ffmpeg, [
        '-hide_banner', '-y',
        '-ss', (startUs / 1_000_000).toFixed(6),
        '-to', (endUs / 1_000_000).toFixed(6),
        '-i', input,
        '-c', 'copy',
        '-movflags', '+faststart',
        output,
    ]);
};

export interface TranscodeRequest {
    input: string;
    output: string;
    /** Target width; height derives from source aspect ratio when omitted together. */
    width?: number;
    height?: number;
    fps?: number;
    videoCodec?: 'h264' | 'vp9';
    bins?: MediaBinaries;
}

/** Re-encode with optional rescale/fps change (always re-encodes; deterministic by construction). */
export const transcodeRescale = async ({
    input, output, width, height, fps, videoCodec = 'h264', bins = defaultBins(),
}: TranscodeRequest): Promise<void> => {
    const vfParts: string[] = [];
    if (width && height) vfParts.push(`scale=${width}:${height}`);
    else if (width) vfParts.push(`scale=${width}:-2`);
    else if (height) vfParts.push(`scale=-2:${height}`);
    const args = ['-hide_banner', '-y', '-i', input];
    if (vfParts.length) args.push('-vf', vfParts.join(','));
    if (fps) args.push('-r', String(fps));
    args.push(
        '-c:v', videoCodec === 'vp9' ? 'libvpx-vp9' : 'libx264',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        output,
    );
    await runBin(bins.ffmpeg, args);
};

export interface ReplaceAudioRequest {
    videoInput: string;
    audioInput: string;
    output: string;
    /** EBU R128 single-pass loudness normalization of the incoming audio. */
    normalize?: boolean;
    /** End output at the shorter stream (default true). */
    shortest?: boolean;
    bins?: MediaBinaries;
}

/** Swap a video's audio track; original video stream is copied untouched. */
export const replaceAudioTrack = async ({
    videoInput, audioInput, output, normalize = false, shortest = true, bins = defaultBins(),
}: ReplaceAudioRequest): Promise<void> => {
    // Inputs first, then output options — ffmpeg rejects -map applied to an input.
    const args = ['-hide_banner', '-y', '-i', videoInput, '-i', audioInput];
    if (normalize) {
        args.push('-filter_complex', '[1:a]loudnorm[aout]', '-map', '0:v:0', '-map', '[aout]');
    } else {
        args.push('-map', '0:v:0', '-map', '1:a:0');
    }
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
    if (shortest) args.push('-shortest');
    args.push('-movflags', '+faststart', output);
    await runBin(bins.ffmpeg, args);
};

/** Grab a single frame as JPEG at the given offset (default first frame). */
export const extractThumbnail = async (
    input: string,
    output: string,
    atUs = 0,
    bins: MediaBinaries = defaultBins(),
): Promise<void> => {
    await runBin(bins.ffmpeg, [
        '-hide_banner', '-y',
        '-ss', (atUs / 1_000_000).toFixed(6),
        '-i', input,
        '-frames:v', '1',
        '-q:v', '3',
        output,
    ]);
};

/** Scratch directory helper for job-local intermediates (caller cleans up). */
export const makeScratchDir = (label = 'indii-media'): Promise<string> =>
    mkdtemp(path.join(tmpdir(), `${label}-`));
