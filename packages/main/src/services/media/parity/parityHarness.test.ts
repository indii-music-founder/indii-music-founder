/**
 * Parity harness calibration tests (MIG-007).
 *
 * Positive control: two renders of ONE composition must judge `identical`
 * (byte-deterministic engine). Negative control: a perturbed composition must
 * judge `mismatch`. If either control fails, the gauge itself is broken.
 */

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeMedia } from '../MediaOps.js';
import { HyperFramesAdapter } from '../../video/HyperFramesAdapter.js';
import { DEFAULT_THRESHOLDS, judge } from './frameCompare.js';
import type { FrameComparison } from './frameCompare.js';
import { runParityComparison, writeParityReports } from './parityHarness.js';

const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';

let root: string;
let compA: string;
let compB: string;

const compositionHtml = (title: string, bg: string): string => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=320, height=180" />
<script src="./gsap.min.js"></script>
<style>
  body { margin:0; }
  #root { position:relative; width:320px; height:180px; overflow:hidden; background:${bg}; }
  .clip { position:absolute; inset:0; display:grid; place-items:center; color:#fff;
          font-family:sans-serif; font-size:28px; font-weight:700; }
</style></head>
<body><div id="root" data-composition-id="main" data-start="0"
  data-width="320" data-height="180" data-duration="2">
  <section class="clip" data-start="0" data-duration="2" data-track-index="1"><span>${title}</span></section>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.to("span", { opacity: 1, duration: 0.001 }, 0);
  window.__timelines["main"] = tl;
</script></body></html>`;

beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'parity-calib-'));
    compA = path.join(root, 'compA');
    compB = path.join(root, 'compB');
    await mkdir(compA); await mkdir(compB);

    // GSAP is vendored locally so the fixture is network-free at render time.
    const res = await fetch('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js');
    if (!res.ok) throw new Error(`gsap download failed: ${res.status}`);
    const gsap = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(compA, 'gsap.min.js'), gsap);
    await writeFile(path.join(compA, 'index.html'), compositionHtml('CAL-A', '#101418'));
    await writeFile(path.join(compB, 'gsap.min.js'), gsap);
    await writeFile(path.join(compB, 'index.html'), compositionHtml('CAL-B', '#20181e'));
}, 60_000);

afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

const renderViaAdapter = async (
    projectDir: string,
    outputLocation: string,
): Promise<string> => {
    const adapter = new HyperFramesAdapter();
    const receipt = await adapter.renderCompositionCloud({
        compositionId: 'main',
        outputLocation,
        projectId: 'proj-parity',
        organizationId: 'org-parity',
        inputProps: { projectDir },
    });
    return receipt.asset.url.replace(/^file:\/\//, '');
};

describe('parity harness calibration (positive control)', () => {
    it('judges two renders of the SAME composition as identical', async () => {
        const workDir = path.join(root, 'pos');
        const result = await runParityComparison({
            fixtureId: 'calibration-positive',
            workDir,
            renderA: async () => {
                const out = path.join(workDir, 'a.mp4');
                const p = path.parse(out);
                await mkdir(p.dir, { recursive: true });
                const videoPath = await renderViaAdapter(compA, out);
                return { label: 'LEGACY-slot(same-engine)', videoPath, probe: await probeMedia(videoPath) };
            },
            renderB: async () => {
                const out = path.join(workDir, 'b.mp4');
                const videoPath = await renderViaAdapter(compA, out);
                return { label: 'NEW(same-engine)', videoPath, probe: await probeMedia(videoPath) };
            },
        });
        expect(result.verdict).toBe('identical');
        expect(result.frames.identityRatio).toBe(1);
        expect(result.metadataDelta.durationUsDelta).toBeLessThanOrEqual(30_000);
    }, 120_000);

    it('writes human + machine reports', async () => {
        const workDir = path.join(root, 'reports');
        const result = await runParityComparison({
            fixtureId: 'calibration-reports',
            workDir,
            renderA: async () => {
                const videoPath = await renderViaAdapter(compA, path.join(workDir, 'ra.mp4'));
                return { label: 'A', videoPath, probe: await probeMedia(videoPath) };
            },
            renderB: async () => {
                const videoPath = await renderViaAdapter(compA, path.join(workDir, 'rb.mp4'));
                return { label: 'B', videoPath, probe: await probeMedia(videoPath) };
            },
        });
        const { markdownPath } = await writeParityReports(result, workDir);
        const { readFile } = await import('node:fs/promises');
        const md = await readFile(markdownPath, 'utf8');
        expect(md).toContain('# Parity Report — calibration-reports');
        expect(md).toMatch(/Verdict:\+\s+`IDENTICAL`|`IDENTICAL`/);
        expect(md).toContain('identityRatio: 1.0000');
    }, 120_000);
});

describe('parity harness calibration (negative control)', () => {
    it('flags a perturbed composition as mismatch below threshold', async () => {
        const workDir = path.join(root, 'neg');
        const result = await runParityComparison({
            fixtureId: 'calibration-negative',
            workDir,
            renderA: async () => {
                const videoPath = await renderViaAdapter(compA, path.join(workDir, 'a.mp4'));
                return { label: 'A', videoPath, probe: await probeMedia(videoPath) };
            },
            renderB: async () => {
                const videoPath = await renderViaAdapter(compB, path.join(workDir, 'b.mp4'));
                return { label: 'B-perturbed', videoPath, probe: await probeMedia(videoPath) };
            },
        });
        expect(result.verdict).toBe('mismatch');
        expect(result.frames.identityRatio).toBeLessThan(DEFAULT_THRESHOLDS.minIdentityRatio);
        expect(result.frames.mismatchedIndexes.length).toBeGreaterThan(0);
    }, 120_000);

    it('rejects visually identical video when audio presence differs', async () => {
        const workDir = path.join(root, 'audio-gate');
        await mkdir(workDir, { recursive: true });
        const silentVideo = await renderViaAdapter(compA, path.join(workDir, 'video-only.mp4'));
        const withAudio = path.join(workDir, 'with-audio.mp4');
        await exec(FFMPEG, [
            '-hide_banner', '-y', '-i', silentVideo,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
            '-c:v', 'copy', '-c:a', 'aac', '-shortest', withAudio,
        ]);

        const result = await runParityComparison({
            fixtureId: 'calibration-audio-mismatch',
            workDir,
            renderA: async () => ({ label: 'video-only', videoPath: silentVideo, probe: await probeMedia(silentVideo) }),
            renderB: async () => ({ label: 'same-video-with-audio', videoPath: withAudio, probe: await probeMedia(withAudio) }),
        });
        expect(result.frames.identityRatio).toBe(1);
        expect(result.metadataDelta.audioPresenceMatch).toBe(false);
        expect(result.metadataDelta.structuralPass).toBe(false);
        expect(result.verdict).toBe('mismatch');
    }, 120_000);
});

describe('judge()', () => {
    const fc = (ratio: number): FrameComparison => ({
        totalCompared: 10, matchedFrames: Math.round(ratio * 10),
        mismatchedIndexes: [], missingAlignment: 0, identityRatio: ratio,
    });
    it('maps ratio bands to verdicts', () => {
        expect(judge(fc(1))).toBe('identical');
        expect(judge(fc(0.99), { minIdentityRatio: 0.98 })).toBe('within-threshold');
        expect(judge(fc(0.9), { minIdentityRatio: 0.98 })).toBe('mismatch');
    });
});
