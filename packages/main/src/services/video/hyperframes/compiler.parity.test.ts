/**
 * Parity + executor contract tests (MIG-008): the pure compiler lives in
 * @indii/video-compiler; these tests hold the main-process side of the
 * contract — every parity fixture compiles, passes REAL hyperframes lint,
 * and one composed fixture renders end-to-end through the desktop adapter.
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

import { compileProjectToHyperFrames } from '@indii/video-compiler';
import { probeMedia } from '../../media/MediaOps.js';
import { HyperFramesAdapter, resolveHyperFramesCliEntry } from '../HyperFramesAdapter.js';
import { PARITY_FIXTURES } from '../../media/parity/parityFixtures.js';

const exec = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) ?? 'ffmpeg';

let root: string;
let gsapCache: Buffer | null = null;
const readFileGsap = async (): Promise<Buffer> => {
    gsapCache ??= await readFile(path.join(__dirname, '__fixtures__/gsap.min.js'));
    return gsapCache;
};

const writeCompiled = async (fixtureId: string): Promise<string> => {
    const fixture = PARITY_FIXTURES[fixtureId];
    if (!fixture) throw new Error(`unknown fixture ${fixtureId}`);
    const dir = path.join(root, fixtureId);
    await mkdir(dir, { recursive: true });
    const compiled = compileProjectToHyperFrames(fixture.project);
    await writeFile(path.join(dir, 'index.html'), compiled.html);
    await writeFile(path.join(dir, 'gsap.min.js'), await readFileGsap());
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

beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'hf-parity-'));
}, 60_000);

afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

describe('parity fixtures through the shared compiler', () => {
    it('emits the document contract for every parity fixture and passes real lint', async () => {
        for (const fixtureId of Object.keys(PARITY_FIXTURES)) {
            const dir = await writeCompiled(fixtureId);
            const envHome = process.env.HYPERFRAMES_HOME || '/tmp/hyperframes-home';
            await exec(process.execPath, [resolveHyperFramesCliEntry(), 'lint'], {
                cwd: dir,
                env: { ...process.env, HOME: envHome, XDG_CACHE_HOME: `${envHome}/.cache` },
            });
        }
        expect(true).toBe(true); // reaching here = all lints exited 0
    }, 240_000);

    it('renders a compiled composed fixture end-to-end through the desktop adapter and probes the artifact', async () => {
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
