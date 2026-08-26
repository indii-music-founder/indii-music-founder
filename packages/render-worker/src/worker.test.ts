import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

import { stageMedia } from './stage';
import { prepareComposition } from './composition';
import { executeRenderJob, type ExecuteJobDependencies, type JobStore } from './job';
import { runHyperFramesRender } from './render';

const project = (srcs: { id: string; src: string; type?: 'video' | 'image' }[]): IndiiVideoProject => ({
    id: 'proj-1', name: 'Test', fps: 30, width: 320, height: 180, durationInFrames: 60,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
    clips: srcs.map(({ id, src, type }) => ({
        id, src, type: type ?? 'video', name: id, trackId: 't1',
        startFrame: 0, durationInFrames: 60,
    })),
});

describe('stageMedia', () => {
    let dir: string;
    beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), 'stage-')); });
    afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

    it('downloads media clips to deterministic local names and rewrites src values', async () => {
        const fetched = new Map<string, string>();
        const fetchToFile = vi.fn(async (url: string, destination: string) => {
            fetched.set(url, destination);
            await writeFile(destination, 'payload');
        });

        const staged = await stageMedia(project([
            { id: 'clip-1', src: 'https://cdn.example/a.mp4?token=x' },
            { id: 'clip 2!', src: 'gs://bucket/raw/b.MOV' },
        ]), dir, fetchToFile);

        expect(staged.clips[0]!.src).toBe('clip-1.mp4');
        expect(staged.clips[1]!.src).toBe('clip-2-.mov');
        expect(fetched.size).toBe(2);
        expect(fetched.has('https://cdn.example/a.mp4?token=x')).toBe(true);
        expect(fetched.has('gs://bucket/raw/b.MOV')).toBe(true);
    });

    it('leaves text clips untouched and skips clips without a source', async () => {
        const fetchToFile = vi.fn();
        const input = project([{ id: 'v', src: 'https://x/y.mp4' }]);
        const staged = await stageMedia({
            ...input,
            tracks: [...input.tracks, { id: 't2', name: 'TXT', type: 'text' }],
            clips: [
                ...input.clips,
                { id: 't9', type: 'text', text: 'HELLO', name: 'title', trackId: 't2', startFrame: 0, durationInFrames: 60 },
                { id: 'no-src', type: 'video', name: 'empty', trackId: 't1', startFrame: 0, durationInFrames: 60 },
            ],
        }, dir, fetchToFile);

        expect(staged.clips.find(c => c.id === 't9')!.text).toBe('HELLO');
        expect(fetchToFile).toHaveBeenCalledTimes(1);
    });
});

describe('executeRenderJob', () => {
    function harness(initialStatus: string) {
        const store: JobStore = {
            getJob: vi.fn(async () => ({
                data: {
                    status: initialStatus as never,
                    projectId: 'proj-1',
                    userId: 'user-1',
                    outputName: 'final.mp4',
                },
                project: project([{ id: 'c1', src: 'https://x/a.mp4' }]),
            })),
            setRunning: vi.fn(async () => undefined),
            setCompleted: vi.fn(async () => undefined),
            setFailed: vi.fn(async () => undefined),
        };
        const fetchToFile = vi.fn(async (_url: string, destination: string) => {
            await writeFile(destination, 'media');
        });
        const uploadArtifact = vi.fn(async () => ({ url: 'gs://out/final.mp4', generation: '42' }));
        const runRender = vi.fn(async (options: { workDir: string; outputPath: string }) => {
            // Staging must be visible while the render runs; verify it here
            // (the workDir is cleaned up after the job resolves).
            const stagedBytes = await readFile(path.join(options.workDir, 'c1.mp4'), 'utf8');
            expect(stagedBytes).toBe('media');
            await writeFile(options.outputPath, 'mp4-bytes');
        });
        const deps: ExecuteJobDependencies = { store, fetchToFile, uploadArtifact, runRender };
        return { store, fetchToFile, uploadArtifact, runRender, deps };
    }

    it('runs the full pipeline and completes the job', async () => {
        const { store, uploadArtifact, runRender, deps } = harness('queued');

        const result = await executeRenderJob('users/user-1/videoRenderJobs/job-1', deps);

        expect(store.setRunning).toHaveBeenCalledWith('users/user-1/videoRenderJobs/job-1');
        expect(runRender).toHaveBeenCalledTimes(1);
        expect(uploadArtifact).toHaveBeenCalledWith(
            expect.stringContaining('output.mp4'),
            'users/user-1/videoRenderJobs/job-1',
            'final.mp4',
        );
        expect(store.setCompleted).toHaveBeenCalledWith('users/user-1/videoRenderJobs/job-1', 'gs://out/final.mp4', '42');
        expect(result).toEqual({ url: 'gs://out/final.mp4' });
    });

    it('fails the job when the render throws and never claims completion', async () => {
        const { store, deps } = harness('queued');
        const runRender = vi.fn(async () => { throw new Error('chrome died'); });
        deps.runRender = runRender;

        await expect(executeRenderJob('users/user-1/videoRenderJobs/job-1', deps)).rejects.toThrow('chrome died');
        expect(store.setFailed).toHaveBeenCalledWith('users/user-1/videoRenderJobs/job-1', 'chrome died');
        expect(store.setCompleted).not.toHaveBeenCalled();
    });

    it('refuses jobs that are not queued', async () => {
        const { store, deps } = harness('running');
        await expect(executeRenderJob('users/user-1/videoRenderJobs/job-1', deps)).rejects.toThrow(/only queued/);
        expect(store.setRunning).not.toHaveBeenCalled();
    });
});

describe('prepareComposition', () => {
    let dir: string;
    beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), 'comp-')); });
    afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

    it('writes index.html and the vendored gsap runtime', async () => {
        await prepareComposition(project([{ id: 'c1', src: 'a.mp4' }]), dir);
        const html = await readFile(path.join(dir, 'index.html'), 'utf8');
        const gsap = await readFile(path.join(dir, 'gsap.min.js'), 'utf8');
        expect(html).toContain('data-hf-root');
        expect(html).toContain('src="a.mp4"');
        expect(gsap).toContain('gsap');
    });
});

describe('full local pipeline e2e (real CLI + browser)', () => {
    it('stages, compiles, and renders a treated project to a real MP4', async () => {
        const root = await mkdtemp(path.join(tmpdir(), 'worker-e2e-'));
        try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const exec = promisify(execFile);
            const ffmpegPath = (await import('ffmpeg-static')).default as unknown as string;
            await exec(ffmpegPath, ['-f', 'lavfi', '-i', 'color=c=navy:size=320x180:rate=30', '-t', '2', '-pix_fmt', 'yuv420p', '-y', path.join(root, 'source.mp4')]);
            await exec(ffmpegPath, ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-y', path.join(root, 'bed.mp3')]);

            const input = project([{ id: 'c1', src: path.join(root, 'source.mp4') }]);
            const compDir = path.join(root, 'comp');
            const { mkdir } = await import('node:fs/promises');
            await mkdir(compDir, { recursive: true });
            const staged = await stageMedia(input, compDir, async (url, destination) => {
                const { copyFile } = await import('node:fs/promises');
                await copyFile(url, destination);
            });

            await prepareComposition(staged, compDir);
            const output = path.join(root, 'out.mp4');
            await runHyperFramesRender({ workDir: compDir, outputPath: output, timeoutMs: 180_000 });

            // Solid-color test footage compresses to almost nothing, so probe
            // the artifact for a real duration instead of a byte threshold.
            const probe = await exec('ffprobe', [
                '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', output,
            ]);
            expect(parseFloat(String(probe.stdout).trim())).toBeGreaterThan(1.5);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    }, 240_000);
});
