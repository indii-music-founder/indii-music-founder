/**
 * MediaOps integration tests (MIG-003).
 *
 * Fixtures are generated at run time with the vendored ffmpeg binary — no
 * binary fixtures committed. Assertions probe OUTPUT properties only.
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

import {
    defaultBins,
    extractThumbnail,
    makeScratchDir,
    probeMedia,
    replaceAudioTrack,
    transcodeRescale,
    trimToSpan,
} from './MediaOps';

const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';
const FFPROBE = ((ffprobeStatic as unknown as { path: string }).path) ?? 'ffprobe';

const bins = { ...defaultBins(), ffmpeg: FFMPEG, ffprobe: FFPROBE };

let dir: string;
let silentVideo: string; // 2s, 320x240@30, no audio
let toneAudio: string;   // 1s sine

const makeSilentVideo = async (out: string): Promise<void> => {
    await exec(FFMPEG, [
        '-f', 'lavfi', '-i', 'color=c=red:size=320x240:rate=30',
        '-t', '2', '-pix_fmt', 'yuv420p', '-y', out,
    ]);
};

const makeToneWav = async (out: string): Promise<void> => {
    await exec(FFMPEG, [
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-y', out,
    ]);
};

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mediaops-test-'));
    silentVideo = path.join(dir, 'silent.mp4');
    toneAudio = path.join(dir, 'tone.wav');
    await makeSilentVideo(silentVideo);
    await makeToneWav(toneAudio);
}, 60_000);

afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
});

describe('probeMedia', () => {
    it('reports duration, dimensions and stream presence of the fixture video', async () => {
        const probe = await probeMedia(silentVideo, bins);
        expect(probe.hasVideo).toBe(true);
        expect(probe.hasAudio).toBe(false);
        expect(probe.width).toBe(320);
        expect(probe.height).toBe(240);
        expect(probe.fps).toBeCloseTo(30, 0);
        expect(probe.durationUs).toBeGreaterThan(1_850_000);
        expect(probe.durationUs).toBeLessThan(2_150_000);
        expect(probe.videoCodec).toBe('h264');
    });
});

describe('trimToSpan', () => {
    it('produces a clip matching the requested µs span within tolerance', async () => {
        const out = path.join(dir, 'trim.mp4');
        await trimToSpan({ input: silentVideo, output: out, startUs: 500_000, endUs: 1_500_000, bins });
        const probe = await probeMedia(out, bins);
        expect(probe.durationUs).toBeGreaterThan(800_000);
        expect(probe.durationUs).toBeLessThan(1_200_000);
    });

    it('fails closed on an inverted span', async () => {
        const out = path.join(dir, 'bad.mp4');
        await expect(
            trimToSpan({ input: silentVideo, output: out, startUs: 1_500_000, endUs: 500_000, bins }),
        ).rejects.toThrow(/invalid span/);
        expect(existsSync(out)).toBe(false);
    });
});

describe('transcodeRescale', () => {
    it('rescales to the target width preserving aspect ratio', async () => {
        const out = path.join(dir, 'small.mp4');
        await transcodeRescale({ input: silentVideo, output: out, width: 160, bins });
        const probe = await probeMedia(out, bins);
        expect(probe.width).toBe(160);
        expect(probe.height).toBe(120);
        expect(probe.videoCodec).toBe('h264');
    });
});

describe('replaceAudioTrack', () => {
    it('swaps in the new audio and ends at the shorter stream', async () => {
        const out = path.join(dir, 'withaudio.mp4');
        await replaceAudioTrack({ videoInput: silentVideo, audioInput: toneAudio, output: out, bins });
        const probe = await probeMedia(out, bins);
        expect(probe.hasVideo).toBe(true);
        expect(probe.hasAudio).toBe(true);
        // tone is 1s; -shortest ends output near 1s even though video is 2s
        expect(probe.durationUs).toBeLessThan(1_400_000);
        expect(probe.audioCodec).toBe('aac');
    });
});

describe('extractThumbnail', () => {
    it('writes a valid JPEG at the requested offset', async () => {
        const out = path.join(dir, 'thumb.jpg');
        await extractThumbnail(silentVideo, out, 1_000_000, bins);
        const buf = await import('node:fs/promises').then(m => m.readFile(out));
        // JPEG magic bytes — truthier than any size guess on solid-color frames
        expect(buf.length).toBeGreaterThan(100);
        expect(buf[0]).toBe(0xff);
        expect(buf[1]).toBe(0xd8);
        expect(buf[2]).toBe(0xff);
    });
});

describe('makeScratchDir', () => {
    it('creates a unique scratch directory under the OS temp root', async () => {
        const scratch = await makeScratchDir();
        expect(existsSync(scratch)).toBe(true);
        expect(path.dirname(scratch)).toBe(tmpdir());
        await rm(scratch, { recursive: true, force: true });
    });
});
