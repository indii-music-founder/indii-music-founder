/**
 * Compiler tests (MIG-008 / MIG-010) — the translation layer's contract,
 * self-contained in the pure package so every executor shares these proofs.
 * The combined treatment fixture passes the REAL hyperframes lint.
 */

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compileProjectToHyperFrames } from './compiler';
import type { IndiiVideoProject } from '@indii/shared';

const require = createRequire(import.meta.url);
const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';

const resolveCliEntry = (): string => {
    const pkgPath = require.resolve('hyperframes/package.json');
    const pkg = require('hyperframes/package.json') as { bin: Record<string, string> };
    return path.join(path.dirname(pkgPath), pkg.bin['hyperframes'] ?? 'bin/hyperframes.mjs');
};

const baseProject = (overrides: Partial<IndiiVideoProject>): IndiiVideoProject => ({
    id: 'fx-base', name: 'Fixture: base', fps: 30, width: 320, height: 180,
    durationInFrames: 30,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
    clips: [{
        id: 'c1', type: 'video', src: 'input.mp4', name: 'src',
        startFrame: 0, durationInFrames: 30, trackId: 't1',
        sourceInUs: 250_000, sourceOutUs: 1_250_000,
    }],
    ...overrides,
});

let root: string;
beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'vc-'));
}, 60_000);
afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

describe('compileProjectToHyperFrames (pure package)', () => {
    it('maps source ranges and layout into timing attributes', () => {
        const project = baseProject({
            clips: [{
                id: 'c1', type: 'video', src: 'input.mp4', name: 'src',
                startFrame: 0, durationInFrames: 30, trackId: 't1',
                sourceInUs: 250_000, sourceOutUs: 1_250_000,
                width: 0.3, height: 0.4, anchorX: 0.25, anchorY: 0.75,
            }],
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('data-media-start="0.25"');
        expect(html).toContain('data-duration="1"');
        expect(html).toContain('width:30.00%;height:40.00%');
        expect(html).toContain('transform-origin:25.0% 75.0%');
    });

    it('emits a radial-glow background with a finite ambient tween and tints the canvas', () => {
        const project = baseProject({
            background: { kind: 'radial-glow', accent: '#F5B13D', color: '#0B0C0F', glowOpacity: 0.2, glowPosition: 'bottom-left' },
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('id="bg-glow"');
        expect(html).toContain('radial-gradient(circle, %23F5B13D20');
        expect(html).toContain('tl.to("#bg-glow", { scale: 1.1');
        expect(html).toContain('background:#0B0C0F');
    });

    it('emits a ghost-text background with slow drift', () => {
        const project = baseProject({
            background: { kind: 'ghost-text', ghostText: 'DETROIT', accent: '#F5B13D' },
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('id="bg-ghost"');
        expect(html).toContain('>DETROIT</div>');
        expect(html).toContain('tl.to("#bg-ghost", { x: -120, y: -40');
    });

    it('stamps velocity-matched cut-the-curve tweens at adjacent clip boundaries', () => {
        const first = baseProject({}).clips[0]!;
        const project = baseProject({
            durationInFrames: 60,
            clips: [first, { ...first, id: 'c2', name: 'clip2', startFrame: 30 }],
            seam: { type: 'cut-the-curve', direction: 'LEFT' },
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('tl.to("#el-c1-box", { xPercent: -12, autoAlpha: 0, duration: 0.34, ease: "power3.in" }');
        expect(html).toContain('tl.fromTo("#el-c2-box", { xPercent: 10, autoAlpha: 0.35 }, { xPercent: 0, autoAlpha: 1, duration: 0.42, ease: "power4.out", immediateRender: false }');
    });

    it('splits a waterfall-entrance text clip into word spans with staggered arrivals', () => {
        const project = baseProject({
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'TXT', type: 'text' },
            ],
            clips: [
                ...baseProject({ durationInFrames: 60 }).clips.map(clip => ({ ...clip, durationInFrames: 60 })),
                { id: 't9', type: 'text', text: 'THE CITY SLEEPS', name: 'title', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 56, entrance: { type: 'waterfall' } },
            ],
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('<span id="el-t9-w0"');
        expect(html).toContain('>THE</span>');
        expect(html).toContain('tl.set("#el-t9-w0", { y: 70, autoAlpha: 0 }');
        expect(html).toContain('tl.to("#el-t9-w0", { y: 0, duration: 0.2, ease: "power4.out" }');
    });

    it('emits an identifier-safe seek-safe counter for a count-up text clip', () => {
        const project = baseProject({
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'TXT', type: 'text' },
            ],
            clips: [
                ...baseProject({ durationInFrames: 60 }).clips.map(clip => ({ ...clip, durationInFrames: 60 })),
                { id: 'n-1', type: 'text', text: '4', name: 'stat', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 64, countUp: { to: 4, suffix: ' AGENTS' } },
            ],
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('const __counter_el_n_1 = { v: 0 };');
        expect(html).toContain('Math.round(__counter_el_n_1.v)');
        expect(html).not.toContain('__counter_el-n-1');
    });

    it('emits an inverse-zoom arrival and absolute-gain audio fades', () => {
        const project = baseProject({
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't3', name: 'A1', type: 'audio' },
            ],
            clips: [
                { ...baseProject({}).clips[0]!, durationInFrames: 60, entrance: { type: 'inverse-zoom' } },
                { id: 'a1', type: 'audio', src: 'bed.mp3', name: 'bed', startFrame: 0, durationInFrames: 60, trackId: 't3', audioFade: { inSeconds: 1, outSeconds: 2 } },
            ],
        });
        const { html } = compileProjectToHyperFrames(project);
        expect(html).toContain('tl.fromTo("#el-c1-box", { autoAlpha: 0.15, scale: 1.25, filter: "blur(10px)" }');
        expect(html).toContain('data-volume="1"');
        expect(html).toContain('tl.fromTo("#el-a1", { volume: 0 }, { volume: 1');
        expect(html).toContain('tl.to("#el-a1", { volume: 0');
    });

    it('rejects a waterfall + count-up combination on one clip (fail closed)', () => {
        const project = baseProject({
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'TXT', type: 'text' },
            ],
            clips: [
                ...baseProject({ durationInFrames: 60 }).clips.map(clip => ({ ...clip, durationInFrames: 60 })),
                { id: 't9', type: 'text', text: 'X', name: 'title', startFrame: 0, durationInFrames: 60, trackId: 't2', entrance: { type: 'waterfall' }, countUp: { to: 4 } },
            ],
        });
        expect(() => compileProjectToHyperFrames(project)).toThrow(/cannot combine/);
    });

    it('compiles a fully treated project and passes the real hyperframes lint', async () => {
        const project = baseProject({
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'TXT', type: 'text' },
                { id: 't3', name: 'A1', type: 'audio' },
            ],
            clips: [
                { ...baseProject({}).clips[0]! },
                { ...baseProject({}).clips[0]!, id: 'c2', name: 'clip2', startFrame: 30 },
                { id: 't9', type: 'text', text: 'THE WORLD HEARS IT', name: 'title', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 56, entrance: { type: 'waterfall' } },
                { id: 'n1', type: 'text', text: '4', name: 'stat', startFrame: 0, durationInFrames: 60, trackId: 't2', fontSize: 64, countUp: { to: 4, suffix: ' AGENTS' } },
                { id: 'a1', type: 'audio', src: 'bed.mp3', name: 'bed', startFrame: 0, durationInFrames: 60, trackId: 't3', audioFade: { inSeconds: 1, outSeconds: 2 } },
            ],
            background: { kind: 'radial-glow', color: '#0B0C0F', accent: '#F5B13D', glowOpacity: 0.16, glowPosition: 'bottom-left' },
            seam: { type: 'cut-the-curve', direction: 'LEFT' },
        });

        const dir = path.join(root, 'treated');
        await import('node:fs/promises').then(({ mkdir }) => mkdir(dir, { recursive: true }));
        const compiled = compileProjectToHyperFrames(project);
        await writeFile(path.join(dir, 'index.html'), compiled.html);
        await writeFile(path.join(dir, 'gsap.min.js'), await readFile(path.join(__dirname, '__fixtures__/gsap.min.js')));
        await exec(FFMPEG, ['-f', 'lavfi', '-i', `color=c=navy:size=${project.width}x${project.height}:rate=30`, '-t', '2', '-pix_fmt', 'yuv420p', '-y', path.join(dir, 'input.mp4')]);
        await exec(FFMPEG, ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-y', path.join(dir, 'bed.mp3')]);

        const envHome = '/tmp/hyperframes-home';
        await import('node:fs/promises').then(({ mkdir }) => mkdir(path.join(envHome, '.cache'), { recursive: true }));
        await exec(process.execPath, [resolveCliEntry(), 'lint'], {
            cwd: dir,
            env: { ...process.env, HOME: envHome, XDG_CACHE_HOME: path.join(envHome, '.cache') },
        });
        expect(true).toBe(true); // reaching here = treated composition linted clean
    }, 240_000);
});
