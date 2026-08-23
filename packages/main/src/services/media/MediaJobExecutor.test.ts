/**
 * MediaJobExecutor integration tests (MIG-004) — routed decisions executed
 * end-to-end against the vendored FFmpeg; composed routes refused.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { VideoRouteDecision } from '@indii/shared';

import { defaultBins } from './MediaOps.js';
import { executeDirectMediaJob, MediaJobError } from './MediaJobExecutor.js';

const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';
const FFPROBE = ((ffprobeStatic as unknown as { path: string }).path) ?? 'ffprobe';
const bins = { ...defaultBins(), ffmpeg: FFMPEG, ffprobe: FFPROBE };

let dir: string;
let video: string;
let tone: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mediajob-test-'));
    video = path.join(dir, 'video.mp4');
    tone = path.join(dir, 'tone.wav');
    await exec(FFMPEG, ['-f', 'lavfi', '-i', 'color=c=blue:size=320x240:rate=30', '-t', '2', '-pix_fmt', 'yuv420p', '-y', video]);
    await exec(FFMPEG, ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-y', tone]);
}, 60_000);

afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
});

describe('executeDirectMediaJob', () => {
    it('executes a routed trim and probes the artifact', async () => {
        const decision: VideoRouteDecision = { route: 'direct_media', op: 'trim', reason: 'single-clip-trim' };
        const out = path.join(dir, 'trimmed.mp4');
        const probe = await executeDirectMediaJob(decision, {
            input: video, output: out, startUs: 250_000, endUs: 1_750_000,
        }, bins);
        expect(probe.durationUs).toBeGreaterThan(1_300_000);
        expect(probe.durationUs).toBeLessThan(1_700_000);
    });

    it('executes a routed thumbnail', async () => {
        const decision: VideoRouteDecision = { route: 'direct_media', op: 'thumbnail', reason: 'explicit-direct-op' };
        const out = path.join(dir, 'thumb.jpg');
        await executeDirectMediaJob(decision, { input: video, output: out, atUs: 500_000 }, bins);
        expect(existsSync(out)).toBe(true);
    });

    it('refuses composed routes — they belong to the renderer contract', async () => {
        const decision: VideoRouteDecision = { route: 'composed_visual', reason: 'multi-clip-timeline' };
        await expect(
            executeDirectMediaJob(decision, { input: video, output: path.join(dir, 'x.mp4') }, bins),
        ).rejects.toThrow(MediaJobError);
    });

    it('fails closed on missing payload fields for the routed op', async () => {
        const decision: VideoRouteDecision = { route: 'direct_media', op: 'trim', reason: 'single-clip-trim' };
        await expect(
            executeDirectMediaJob(decision, { input: video, output: path.join(dir, 'y.mp4') }, bins),
        ).rejects.toThrow(/startUs and endUs/);
    });

    it('fails closed on unknown ops', async () => {
        const decision = { route: 'direct_media', op: 'teleport', reason: 'bogus' } as unknown as VideoRouteDecision;
        await expect(
            executeDirectMediaJob(decision, { input: video, output: path.join(dir, 'z.mp4') }, bins),
        ).rejects.toThrow(/unknown direct op/);
    });
});
