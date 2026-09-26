/**
 * EngineBenchmark tests (ISSUE-329 phase 2 prep).
 *
 * The engine is a FAKE script (spawn contract, not model quality) and pixel
 * comparisons run on REAL node-canvas encodes/decodes — metric math is
 * verified against ground truth, not mocks.
 */

import { createCanvas } from 'canvas';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { meanAbsoluteError, psnr, runBenchmark } from '../EngineBenchmark';

let dir: string;

const makeImageBytes = async (width: number, height: number, fill: string): Promise<Buffer> => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    return canvas.toBuffer('image/png');
};

const decode = async (bytes: Buffer) => {
    const { loadImage, createCanvas } = await import('canvas');
    const img = await loadImage(bytes);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    return { width: img.width, height: img.height, data: new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength) };
};

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'engine-bench-test-'));
});

afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('metric math', () => {
    it('PSNR is infinite for identical images', async () => {
        const bytes = await makeImageBytes(16, 16, '#336699');
        const a = await decode(bytes);
        expect(psnr(a, a)).toBe(Number.POSITIVE_INFINITY);
    });

    it('PSNR is finite and ordered for noisy vs clean comparisons', async () => {
        const clean = await decode(await makeImageBytes(16, 16, '#336699'));
        const noisy = await decode(await makeImageBytes(16, 16, '#33669a')); // 1-channel-off neighbor
        const noisier = await decode(await makeImageBytes(16, 16, '#3366cc'));
        const pNoisy = psnr(clean, noisy)!;
        const pNoisier = psnr(clean, noisier)!;
        expect(Number.isFinite(pNoisy)).toBe(true);
        expect(pNoisy).toBeGreaterThan(pNoisier);
        expect(pNoisier).toBeGreaterThan(0);
    });

    it('returns null on dimension mismatch', async () => {
        const a = await decode(await makeImageBytes(16, 16, '#000000'));
        const b = await decode(await makeImageBytes(32, 16, '#000000'));
        expect(psnr(a, b)).toBeNull();
        expect(meanAbsoluteError(a, b)).toBeNull();
    });

    it('MAE is 0 for identical images and positive for different ones', async () => {
        const a = await decode(await makeImageBytes(8, 8, '#112233'));
        expect(meanAbsoluteError(a, a)).toBe(0);
        const b = await decode(await makeImageBytes(8, 8, '#445566'));
        expect(meanAbsoluteError(a, b)!).toBeGreaterThan(0);
    });
});

describe('runBenchmark — engine loop contract', () => {
    const writeFakeEngine = async (file: string, body: string): Promise<{ engine: string }> => {
        await writeFile(file, `#!/bin/bash\n${body}\n`);
        await chmod(file, 0o755);
        return { engine: file };
    };

    const makeEngine = async (behavior: 'succeed' | 'fail-one' | 'fail-all'): Promise<{ engine: string }> => {
        const file = path.join(dir, `engine-${behavior}.sh`);
        const body = behavior === 'succeed'
            ? 'touch "$4"'
            : behavior === 'fail-one'
                ? `if grep -q "pair-2" <<< "$*"; then echo boom >&2; exit 1; fi\ntouch "$4"`
                : 'echo nope >&2\nexit 1';
        return writeFakeEngine(file, body);
    };

    it('scores every pair when the engine produces a real near-identical output', async () => {
        // The engine's "upscaled" output: same dims as HR, one bit-step off —
        // PSNR lands finite and high, exercising the full decode→score path.
        const reference = await makeImageBytes(32, 32, '#101011');
        const referencePath = path.join(dir, 'engine-reference.png');
        await writeFile(referencePath, reference);

        const engine = await writeFakeEngine(
            path.join(dir, 'engine-real.sh'),
            `cp ${JSON.stringify(referencePath)} "$4"`,
        );

        const pairs = [
            { id: 'pair-1', lrPath: path.join(dir, 'p1-lr.png'), hrPath: path.join(dir, 'p1-hr.png') },
            { id: 'pair-2', lrPath: path.join(dir, 'p2-lr.png'), hrPath: path.join(dir, 'p2-hr.png') },
        ];
        for (const p of pairs) {
            await writeFile(p.lrPath, await makeImageBytes(16, 16, '#101010'));
            await writeFile(p.hrPath, await makeImageBytes(32, 32, '#101010'));
        }
        const report = await runBenchmark(
            { pairs, outDir: path.join(dir, 'out-ok'), engine, scale: 2 },
            { decodeRgba: decode },
        );
        expect(report.aggregate.succeeded).toBe(2);
        expect(report.aggregate.failed).toBe(0);
        expect(report.aggregate.meanPsnr!).toBeGreaterThan(30); // one-bit-off on one channel ≈ ~46dB
        expect(report.items.every((i) => i.mae! > 0 && i.mae! < 1)).toBe(true);
    }, 30_000);

    it('isolates per-item engine failures when continueOnError', async () => {
        const engine = await makeEngine('fail-one');
        const pairs = [
            { id: 'pair-1', lrPath: path.join(dir, 'iso-1.png'), hrPath: path.join(dir, 'iso-1-hr.png') },
            { id: 'pair-2', lrPath: path.join(dir, 'iso-2.png'), hrPath: path.join(dir, 'iso-2-hr.png') },
        ];
        for (const p of pairs) {
            await writeFile(p.lrPath, await makeImageBytes(16, 16, '#101010'));
            await writeFile(p.hrPath, await makeImageBytes(32, 32, '#101010'));
        }
        const report = await runBenchmark(
            { pairs, outDir: path.join(dir, 'out-iso'), engine, scale: 2 },
            { decodeRgba: decode },
        );
        expect(report.aggregate.count).toBe(2);
        const failed = report.items.find((i) => i.id === 'pair-2');
        expect(failed?.error).toMatch(/exited 1/);
        expect(report.aggregate.failed).toBeGreaterThanOrEqual(1);
    }, 30_000);

    it('throws on first failure when continueOnError is false', async () => {
        const engine = await makeEngine('fail-all');
        await expect(runBenchmark(
            {
                pairs: [{ id: 'p', lrPath: path.join(dir, 't.png'), hrPath: path.join(dir, 't-hr.png') }],
                outDir: path.join(dir, 'out-throw'),
                engine,
                continueOnError: false,
            },
            { decodeRgba: decode },
        )).rejects.toThrow(/Benchmark failed on p/);
    });

    it('cleans up: no orphan outputs when the run completes', async () => {
        const outDir = path.join(dir, 'out-clean');
        const engine = await makeEngine('succeed');
        const pairs = [{ id: 'clean-1', lrPath: path.join(dir, 'c1.png'), hrPath: path.join(dir, 'c1-hr.png') }];
        await writeFile(pairs[0].lrPath, await makeImageBytes(16, 16, '#101010'));
        await writeFile(pairs[0].hrPath, await makeImageBytes(32, 32, '#101010'));
        await runBenchmark({ pairs, outDir, engine }, { decodeRgba: decode });
        expect(existsSync(path.join(outDir, 'clean-1-upscaled.png'))).toBe(true);
    });
});
