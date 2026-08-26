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

describe('cinematic treatment compilation (background, seams, entrances, counters, audio fades)', () => {
    it('emits a radial-glow background layer with its finite ambient tween and tints the canvas', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const project = {
            ...fixture.project,
            background: { kind: 'radial-glow' as const, accent: '#F5B13D', color: '#0B0C0F', glowOpacity: 0.2, glowPosition: 'bottom-left' as const },
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('id="bg-glow"');
        expect(html).toContain('radial-gradient(circle, %23F5B13D20');
        expect(html).toContain('tl.to("#bg-glow", { scale: 1.1');
        expect(html).toContain('background:#0B0C0F');
        expect(html).toContain('data-layout-allow-overflow');
    });

    it('emits a ghost-text background with slow drift', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const project = {
            ...fixture.project,
            background: { kind: 'ghost-text' as const, ghostText: 'DETROIT', accent: '#F5B13D' },
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('id="bg-ghost"');
        expect(html).toContain('>DETROIT</div>');
        expect(html).toContain('tl.to("#bg-ghost", { x: -120, y: -40');
    });

    it('stamps velocity-matched cut-the-curve tweens at adjacent clip boundaries', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const c1 = { ...fixture.project.clips[0]! };
        const c2 = { ...fixture.project.clips[0]!, id: 'c2', name: 'clip2', startFrame: c1.startFrame + c1.durationInFrames };
        const project = {
            ...fixture.project,
            durationInFrames: 60,
            clips: [c1, c2],
            seam: { type: 'cut-the-curve' as const, direction: 'LEFT' as const },
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('tl.to("#el-c1-box", { xPercent: -12, autoAlpha: 0, duration: 0.34, ease: "power3.in" }');
        expect(html).toContain('tl.set("#el-c1-box", { autoAlpha: 0 }');
        expect(html).toContain('tl.fromTo("#el-c2-box", { xPercent: 10, autoAlpha: 0.35 }, { xPercent: 0, autoAlpha: 1, duration: 0.42, ease: "power4.out", immediateRender: false }');
    });

    it('splits a waterfall-entrance text clip into word spans with staggered arrivals', () => {
        const fixture = PARITY_FIXTURES['text-title']!;
        const textClip = fixture.project.clips.find(clip => clip.type === 'text')!;
        const project = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => clip === textClip
                ? { ...clip, text: 'THE CITY SLEEPS', entrance: { type: 'waterfall' as const, staggerSeconds: 0.05 } }
                : clip),
        };
        const { html } = compileProjectToHyperFrames(project);
        const id = textClip.id.replace(/[^a-zA-Z0-9_-]/g, '-');
        expect(html).toContain(`<span id="el-${id}-w0"`);
        expect(html).toContain('>THE</span>');
        expect(html).toContain(`tl.set("#el-${id}-w0", { y: 70, autoAlpha: 0 }`);
        expect(html).toContain(`tl.to("#el-${id}-w0", { y: 0, duration: 0.2, ease: "power4.out" }`);
    });

    it('emits a seek-safe counter for a count-up text clip', () => {
        const fixture = PARITY_FIXTURES['text-title']!;
        const textClip = fixture.project.clips.find(clip => clip.type === 'text')!;
        const project = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => clip === textClip
                ? { ...clip, text: '4', countUp: { to: 4, suffix: ' AGENTS' } }
                : clip),
        };
        const { html } = compileProjectToHyperFrames(project);
        const id = textClip.id.replace(/[^a-zA-Z0-9_-]/g, '-');
        expect(html).toContain(`const __counter_el_${id.replace(/-/g, '_')} = { v: 0 };`);
        expect(html).toContain('snap: { v: 1 }');
        expect(html).toContain('Math.round(__counter_');
        expect(html).toContain('" AGENTS"');
        expect(html).toContain('>0 AGENTS</span>');
    });

    it('emits an inverse-zoom arrival on the clip wrapper', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const project = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => ({ ...clip, entrance: { type: 'inverse-zoom' as const } })),
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('tl.fromTo("#el-c1-box", { autoAlpha: 0.15, scale: 1.25, filter: "blur(10px)" }');
        expect(html).toContain('ease: "expo.out", immediateRender: false');
    });

    it('automates audio fades with absolute-gain volume tweens', () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const project = {
            ...fixture.project,
            tracks: [...fixture.project.tracks, { id: 't2', name: 'A1', type: 'audio' as const }],
            clips: [
                ...fixture.project.clips,
                {
                    id: 'a1', type: 'audio' as const, src: 'bed.mp3', name: 'bed',
                    startFrame: 0, durationInFrames: 30, trackId: 't2',
                    audioFade: { inSeconds: 1, outSeconds: 2 },
                },
            ],
        };
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('data-volume="1"');
        expect(html).toContain('tl.fromTo("#el-a1", { volume: 0 }, { volume: 1');
        expect(html).toContain('tl.to("#el-a1", { volume: 0');
    });

    it('rejects a waterfall + count-up combination on one clip (fail closed)', () => {
        const fixture = PARITY_FIXTURES['text-title']!;
        const textClip = fixture.project.clips.find(clip => clip.type === 'text')!;
        const project = {
            ...fixture.project,
            clips: fixture.project.clips.map(clip => clip === textClip
                ? { ...clip, entrance: { type: 'waterfall' as const }, countUp: { to: 4 } }
                : clip),
        };
        expect(() => compileProjectToHyperFrames(project)).toThrow(/cannot combine/);
    });

    it('compiles a fully treated project (background + seam + waterfall + count-up + audio fades) and passes real lint', async () => {
        const fixture = PARITY_FIXTURES['single-trim']!;
        const c1 = { ...fixture.project.clips[0]! };
        const c2 = { ...fixture.project.clips[0]!, id: 'c2', name: 'clip2', startFrame: 30 };
        const project = {
            ...fixture.project,
            durationInFrames: 60,
            tracks: [
                ...fixture.project.tracks,
                { id: 't2', name: 'TXT', type: 'text' as const },
                { id: 't3', name: 'A1', type: 'audio' as const },
            ],
            clips: [
                c1,
                c2,
                { id: 't9', type: 'text' as const, text: 'THE WORLD HEARS IT', name: 'title', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 56, entrance: { type: 'waterfall' as const } },
                { id: 'n1', type: 'text' as const, text: '4', name: 'stat', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 64, countUp: { to: 4, suffix: ' AGENTS' } },
                { id: 'a1', type: 'audio' as const, src: 'bed.mp3', name: 'bed', startFrame: 0, durationInFrames: 60, trackId: 't3', audioFade: { inSeconds: 1, outSeconds: 2 } },
            ],
            background: { kind: 'radial-glow' as const, color: '#0B0C0F', accent: '#F5B13D', glowOpacity: 0.16, glowPosition: 'bottom-left' as const },
            seam: { type: 'cut-the-curve' as const, direction: 'LEFT' as const },
        };

        const dir = path.join(root, 'treated');
        await mkdir(dir, { recursive: true });
        const compiled = compileProjectToHyperFrames(project);
        await writeFile(path.join(dir, 'index.html'), compiled.html);
        await writeFile(path.join(dir, 'gsap.min.js'), await readFileGsap());
        await exec(FFMPEG, ['-f', 'lavfi', '-i', `color=c=navy:size=${project.width}x${project.height}:rate=30`, '-t', '2', '-pix_fmt', 'yuv420p', '-y', path.join(dir, 'input.mp4')]);
        await exec(FFMPEG, ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-y', path.join(dir, 'bed.mp3')]);

        const envHome = process.env.HYPERFRAMES_HOME || '/tmp/hyperframes-home';
        await exec(process.execPath, [resolveHyperFramesCliEntry(), 'lint'], {
            cwd: dir,
            env: { ...process.env, HOME: envHome, XDG_CACHE_HOME: `${envHome}/.cache` },
        });
        expect(true).toBe(true); // reaching here = treated composition linted clean
    }, 240_000);
});
