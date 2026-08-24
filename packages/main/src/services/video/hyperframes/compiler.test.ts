/**
 * Compiler tests (MIG-008): every parity fixture compiles, passes the REAL
 * hyperframes lint, and one composed fixture renders end-to-end with probed
 * output. This is the translation layer's contract with the engine.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeMedia } from '../../media/MediaOps.js';
import { HyperFramesAdapter, resolveHyperFramesCliEntry } from '../HyperFramesAdapter.js';
import { compileProjectToHyperFrames } from './compiler.js';
import { PARITY_FIXTURES } from '../../media/parity/parityFixtures.js';

const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';

let root: string;
const writeCompiled = async (fixtureId: string): Promise<string> => {
    const fixture = PARITY_FIXTURES[fixtureId];
    if (!fixture) throw new Error(`unknown fixture ${fixtureId}`);
    const dir = path.join(root, fixtureId);
    await mkdir(dir, { recursive: true });
    const compiled = compileProjectToHyperFrames(fixture.project);
    await writeFile(path.join(dir, 'index.html'), compiled.html);
    await writeFile(path.join(dir, 'gsap.min.js'), await readFileGsap());
    // Fixture media placeholders referenced by src (lint checks structure, not media).
    for (const clip of fixture.project.clips) {
        if (clip.type === 'video' && clip.src) {
            await exec(FFMPEG, ['-f', 'lavfi', '-i', `color=c=navy:size=${fixture.project.width}x${fixture.project.height}:rate=30`, '-t', String(fixture.project.durationInFrames / fixture.project.fps), '-pix_fmt', 'yuv420p', '-y', path.join(dir, clip.src)]);
        }
        if (clip.type === 'image' && clip.src) {
            await exec(FFMPEG, ['-f', 'lavfi', '-i', `color=c=tomato:size=160x160`, '-frames:v', '1', '-y', path.join(dir, clip.src)]);
        }
    }
    return dir;
};

let gsapCache: Buffer | null = null;
const readFileGsap = async (): Promise<Buffer> => {
    gsapCache ??= await readFile(path.join(__dirname, '__fixtures__/gsap.min.js'));
    return gsapCache;
};

beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'hf-compiler-'));
}, 60_000);

afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

describe('compileProjectToHyperFrames', () => {
    it('maps numeric tracks, source ranges, layout, mute/hidden state, audio, and single keyframes', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const project = {
            ...fixture.project,
            tracks: fixture.project.tracks.map(track => ({ ...track, isMuted: true, isHidden: true })),
            clips: fixture.project.clips.map(clip => ({
                ...clip,
                width: 0.3,
                height: 0.4,
                anchorX: 0.25,
                anchorY: 0.75,
                hasAudio: true,
                keyframes: { opacity: [{ frame: 5, value: 0.6, easing: 'easeOut' as const }] },
            })),
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('data-track-index="1"');
        expect(html).toContain('data-hf-root');
        expect(html).toContain('data-hf-id="hf-el-c1-media"');
        expect(html).not.toContain('data-track-index="t1"');
        expect(html).toContain('data-media-start="0.25"');
        expect(html).toContain('data-duration="1"');
        expect(html).toContain('width:30.00%;height:40.00%');
        expect(html).toContain('transform-origin:25.0% 75.0%');
        expect(html).toContain('data-track-index="2" data-media-start="0.25" data-volume="0" data-hidden="true"');
        expect(html).toContain('tl.set("#el-c1", {"opacity":0.6}, 0.166667);');
    });

    it('fails closed when only one side of a source range is present', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const broken = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => ({ ...clip, sourceOutUs: undefined })),
        };
        expect(() => compileProjectToHyperFrames(broken)).toThrow(/sourceInUs and sourceOutUs together/);
    });

    it('maps overlapping indii clips onto distinct engine lanes', () => {
        const fixture = PARITY_FIXTURES['text-title']!;
        const project = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => ({ ...clip, trackId: fixture.project.tracks[0]!.id })),
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('data-track-index="1"');
        expect(html).toContain('data-track-index="2"');
    });

    it('emits the document contract for every parity fixture and passes real lint', async () => {
        for (const fixtureId of Object.keys(PARITY_FIXTURES)) {
            const dir = await writeCompiled(fixtureId);
            const envHome = process.env.HYPERFRAMES_HOME || '/tmp/hyperframes-home';
            await exec(process.execPath, [resolveHyperFramesCliEntry(), 'lint'], {
                cwd: dir,
                env: { ...process.env, HOME: envHome, XDG_CACHE_HOME: `${envHome}/.cache` },
            });
        }
        expect(true).toBe(true); // reaching here = all four lints exited 0
    }, 240_000);

    it('rejects clips referencing unknown tracks (fail closed)', () => {
        const fixture = PARITY_FIXTURES['text-title']!;
        const broken = {
            ...fixture.project,
            clips: fixture.project.clips.map((c, i) => (i === 0 ? c : { ...c, trackId: 'nope' })),
        };
        expect(() => compileProjectToHyperFrames(broken)).toThrow(/unknown track/);
    });

    it('renders a compiled composed fixture end-to-end and probes the artifact', async () => {
        const dir = await writeCompiled('text-title');
        const adapter = new HyperFramesAdapter();
        const out = path.join(root, 'text-title.mp4');
        const receipt = await adapter.renderCompositionCloud({
            compositionId: 'main',
            outputLocation: out,
            projectId: 'proj-1',
            organizationId: 'org-1',
            inputProps: { projectDir: dir },
        });
        expect(receipt.status).toBe('completed');
        expect(existsSync(out)).toBe(true);
        const probe = await probeMedia(out);
        expect(probe.hasVideo).toBe(true);
        expect(probe.durationUs).toBeGreaterThan(1_700_000); // 2s ± tolerance
        expect(probe.durationUs).toBeLessThan(2_300_000);
    }, 180_000);
});
