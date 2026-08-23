/**
 * Frame-level comparison machinery for the golden parity harness (MIG-007).
 *
 * Videos are sampled to small grayscale PNGs at a fixed rate; frames are
 * compared by content hash, index-aligned. Byte-deterministic engines yield
 * ratio 1.0; thresholds make cross-engine comparisons configurable.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ExtractOptions {
    /** Sampling fps (default 6 — 12 samples for a 2s clip). */
    sampleFps?: number;
    /** Downscale width for hashing (default 160). */
    scaleWidth?: number;
    bins?: { ffmpeg: string };
}

/** Sample a video into sequentially numbered PNGs; returns sorted paths. */
export const extractFrameSamples = (
    input: string,
    outDir: string,
    opts: ExtractOptions = {},
): Promise<string[]> => {
    const ffmpeg = opts.bins?.ffmpeg ?? 'ffmpeg';
    const sampleFps = opts.sampleFps ?? 6;
    const scaleWidth = opts.scaleWidth ?? 160;
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpeg, [
            '-hide_banner', '-y',
            '-i', input,
            '-vf', `fps=${sampleFps},scale=${scaleWidth}:-1:flags=neighbor,format=gray`,
            '-start_number', '0',
            path.join(outDir, 'f%04d.png'),
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', d => { stderr += String(d); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) {
                reject(new Error(`frame extraction exited ${code}: ${stderr.slice(-400)}`));
                return;
            }
            const frames = readdirSync(outDir)
                .filter(f => f.endsWith('.png'))
                .sort()
                .map(f => path.join(outDir, f));
            if (frames.length === 0) {
                reject(new Error('frame extraction produced no samples'));
                return;
            }
            resolve(frames);
        });
    });
};

const hashFile = (file: string): string =>
    createHash('sha256').update(readFileSync(file)).digest('hex');

export interface FrameComparison {
    totalCompared: number;
    matchedFrames: number;
    mismatchedIndexes: number[];
    missingAlignment: number;
    identityRatio: number;
}

/** Index-aligned content-hash comparison of two frame-sample sets. */
export const compareFrameSets = (
    framesA: string[],
    framesB: string[],
): FrameComparison => {
    const total = Math.max(framesA.length, framesB.length);
    if (total === 0) throw new Error('cannot compare empty frame sets');
    let matched = 0;
    let missing = 0;
    const mismatchedIndexes: number[] = [];
    for (let i = 0; i < total; i += 1) {
        const a = framesA[i];
        const b = framesB[i];
        if (!a || !b) {
            missing += 1;
            mismatchedIndexes.push(i);
            continue;
        }
        if (hashFile(a) === hashFile(b)) matched += 1;
        else mismatchedIndexes.push(i);
    }
    return {
        totalCompared: total,
        matchedFrames: matched,
        mismatchedIndexes,
        missingAlignment: missing,
        identityRatio: matched / total,
    };
};

export interface ParityThresholds {
    /** Minimum identityRatio to pass (1.0 = byte-identical sampling). Within-engine gate. */
    minIdentityRatio: number;
    /** Minimum global SSIM to pass (0..1). Cross-engine perceptual gate. When set,
     *  SSIM supersedes identityRatio for the verdict. */
    minSsim?: number;
    /** Maximum container/stream duration drift allowed before visual scores are considered. */
    maxDurationDeltaUs?: number;
    /** Audio stream presence must match on both sides (default true in the harness). */
    requireAudioMatch?: boolean;
}

export const DEFAULT_THRESHOLDS: ParityThresholds = {
    minIdentityRatio: 1.0,
    maxDurationDeltaUs: 50_000,
    requireAudioMatch: true,
};

export type ParityVerdict = 'identical' | 'within-threshold' | 'mismatch';

export const judge = (
    comparison: FrameComparison,
    thresholds: ParityThresholds = DEFAULT_THRESHOLDS,
): ParityVerdict => {
    if (comparison.identityRatio >= thresholds.minIdentityRatio) {
        return comparison.identityRatio === 1 ? 'identical' : 'within-threshold';
    }
    return 'mismatch';
};

export interface SsimResult {
    /** Global mean SSIM (0..1, 1 = identical luminance structure). */
    score: number;
    rawLine?: string;
}

/**
 * Perceptual comparison via ffmpeg's SSIM filter — the meaningful metric
 * CROSS-engine, where byte-identity is impossible (different Chromium builds
 * rasterize text/anti-aliasing differently). Within-engine runs keep the
 * byte-hash path as the strict gate.
 */
export const computeSsim = (
    videoA: string,
    videoB: string,
    bins: { ffmpeg: string } = { ffmpeg: 'ffmpeg' },
): Promise<SsimResult> =>
    new Promise((resolve, reject) => {
        const child = spawn(bins.ffmpeg, [
            '-hide_banner', '-i', videoA, '-i', videoB,
            '-lavfi', 'ssim', '-f', 'null', '-',
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', d => { stderr += String(d); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0 && !stderr.includes('SSIM')) {
                reject(new Error(`ssim exited ${code}: ${stderr.slice(-300)}`));
                return;
            }
            const match = stderr.match(/All:([\d.]+)/);
            if (!match) {
                reject(new Error(`ssim not found in output: ${stderr.slice(-200)}`));
                return;
            }
            resolve({ score: Number(match[1]), rawLine: stderr.match(/SSIM.*\n?.*/)?.[0] });
        });
    });
