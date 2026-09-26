/**
 * UpscaleExecutor tests (ISSUE-323).
 *
 * The engine is a FAKE shell script per test — the contract under test is
 * the spawn interface (args, timeout, abort, fail-closed output validation),
 * not model quality. No GPU required.
 */

import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeEngine, runUpscale, type UpscaleBinaries } from './UpscaleExecutor';

let dir: string;
let inputPng: string;
let bins: UpscaleBinaries;

const writeFakeEngine = async (name: string, body: string): Promise<UpscaleBinaries> => {
    const file = path.join(dir, name);
    await writeFile(file, `#!/bin/bash\n${body}\n`);
    await chmod(file, 0o755);
    return { engine: file };
};

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'upscale-exec-test-'));
    inputPng = path.join(dir, 'in.png');
    await writeFile(inputPng, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('runUpscale — spawn contract', () => {
    it('assembles engine args and reports a successful output', async () => {
        const argsFile = path.join(dir, 'args-success.txt');
        const outPath = path.join(dir, 'out-success.png');
        const engine = await writeFakeEngine(
            'engine-success.sh',
            `printf '%s\\n' "$@" > ${JSON.stringify(argsFile)}
# args: $1=-i $2=in $3=-o $4=out $5=-n $6=model $7=-s $8=scale $9=-t $10=tile $11=-f $12=ext
touch "$4"
echo "progress 50%" >&2`,
        );
        bins = engine;

        const outcome = await runUpscale(
            { inputPath: inputPng, outputPath: outPath, scale: 4, model: 'realesrgan-x4plus-anime', tilePx: 512, timeoutMs: 30_000 },
            engine,
        );

        expect(outcome.outputPath).toBe(outPath);
        expect(existsSync(outPath)).toBe(true);
        expect(outcome.stderrTail).toContain('progress 50%');

        const recorded = await (await import('node:fs/promises')).readFile(argsFile, 'utf8');
        const lines = recorded.trim().split('\n');
        // -i input -o output -n model -s scale -t tile -f ext
        expect(lines).toEqual([
            '-i', inputPng,
            '-o', outPath,
            '-n', 'realesrgan-x4plus-anime',
            '-s', '4',
            '-t', '512',
            '-f', 'png',
        ]);
    });

    it('rejects with the stderr tail on engine failure', async () => {
        const engine = await writeFakeEngine(
            'engine-fail.sh',
            `echo "vkEnumeratePhysicalDevices failed" >&2
exit 1`,
        );
        await expect(runUpscale(
            { inputPath: inputPng, outputPath: path.join(dir, 'out-fail.png'), scale: 2, timeoutMs: 30_000 },
            engine,
        )).rejects.toThrow(/exited 1.*vkEnumeratePhysicalDevices/);
    });

    it('fails closed when the engine exits 0 but writes no output', async () => {
        const engine = await writeFakeEngine('engine-liar.sh', 'exit 0');
        await expect(runUpscale(
            { inputPath: inputPng, outputPath: path.join(dir, 'out-missing.png'), scale: 4, timeoutMs: 30_000 },
            engine,
        )).rejects.toThrow(/produced no output/);
    });

    it('enforces the hard timeout with SIGKILL', async () => {
        const engine = await writeFakeEngine('engine-slow.sh', 'sleep 30');
        await expect(runUpscale(
            { inputPath: inputPng, outputPath: path.join(dir, 'out-slow.png'), scale: 2, timeoutMs: 500 },
            engine,
        )).rejects.toThrow(/timed out after 500ms/);
    }, 15_000);

    it('rejects when the caller aborts mid-run', async () => {
        const engine = await writeFakeEngine('engine-abort.sh', 'sleep 30');
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 300);
        await expect(runUpscale(
            { inputPath: inputPng, outputPath: path.join(dir, 'out-abort.png'), scale: 2, timeoutMs: 60_000, signal: controller.signal },
            engine,
        )).rejects.toThrow(/aborted by caller/);
    }, 15_000);

    it('validates request sanity before spawning', async () => {
        await expect(runUpscale(
            { inputPath: inputPng, outputPath: path.join(dir, 'o.png'), scale: 3 as 2 },
            { engine: 'x' },
        )).rejects.toThrow(/scale must be 2 or 4/);
        await expect(runUpscale(
            { inputPath: path.join(dir, 'missing.png'), outputPath: path.join(dir, 'o.png'), scale: 2 },
            { engine: 'x' },
        )).rejects.toThrow(/input not found/);
    });
});

describe('probeEngine — capability probe', () => {
    it('reports gpuReady on a healthy usage response', async () => {
        const engine = await writeFakeEngine(
            'engine-usage.sh',
            `echo "Usage: engine -i input -o output" >&2
exit 1`,
        );
        const probe = await probeEngine(engine);
        expect(probe.enginePresent).toBe(true);
        expect(probe.gpuReady).toBe(true);
    });

    it('reports gpu not ready when Vulkan device enumeration fails', async () => {
        const engine = await writeFakeEngine(
            'engine-novulkan.sh',
            `echo "vkEnumeratePhysicalDevices failed" >&2
exit 1`,
        );
        const probe = await probeEngine(engine);
        expect(probe.enginePresent).toBe(true);
        expect(probe.gpuReady).toBe(false);
    });

    it('reports the engine missing when the binary does not exist', async () => {
        const probe = await probeEngine({ engine: path.join(dir, 'no-such-engine') });
        expect(probe.enginePresent).toBe(false);
        expect(probe.gpuReady).toBe(false);
    });
});
