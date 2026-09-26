/**
 * EngineBenchmark — baseline evaluation harness for the domain upscaler
 * (ISSUE-329 phase 2 prep, zero-spend).
 *
 * Given (LR, HR) pairs and an engine binary, upscales each LR with the real
 * engine and scores the result against the HR ground truth with PSNR +
 * mean-absolute-error over RGBA pixels. Produces per-item and aggregate
 * reports so the GO/NO-GO on fine-tuning is decided on measured numbers,
 * not impressions.
 *
 * The engine runner and image decoding are injectable; tests use fake
 * engines and synthetic canvases — no GPU, no network.
 */

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { runUpscale, type UpscaleBinaries } from '../UpscaleExecutor';

export interface ImageAccess {
    /** Decode image bytes into RGBA pixel data + dims. */
    decodeRgba(bytes: Buffer): Promise<{ width: number; height: number; data: Uint8Array }>;
}

export interface BenchmarkPair {
    id: string;
    lrPath: string;
    hrPath: string;
}

export interface ItemBenchmark {
    id: string;
    psnr: number | null; // null when engine output dims mismatch HR (cannot compare)
    mae: number | null;
    durationMs: number;
    error?: string;
}

export interface BenchmarkReport {
    items: ItemBenchmark[];
    aggregate: {
        count: number;
        succeeded: number;
        failed: number;
        meanPsnr: number | null;
        minPsnr: number | null;
        maxPsnr: number | null;
        totalDurationMs: number;
    };
}

export interface BenchmarkOptions {
    pairs: BenchmarkPair[];
    outDir: string;
    engine: UpscaleBinaries;
    model?: string;
    scale?: 2 | 4;
    timeoutMs?: number;
    /** Continues on per-item failures (default true). */
    continueOnError?: boolean;
}

const DefaultImageAccess: ImageAccess = {
    async decodeRgba(bytes: Buffer) {
        const { createCanvas, loadImage } = await import('canvas');
        const img = await loadImage(bytes);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        return { width: img.width, height: img.height, data: new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength) };
    },
};

/**
 * PSNR over overlapping RGBA pixels. Requires identical dimensions — callers
 * get null when the engine output size differs from the HR reference.
 */
export function psnr(a: { width: number; height: number; data: Uint8Array }, b: { width: number; height: number; data: Uint8Array }): number | null {
    if (a.width !== b.width || a.height !== b.height) return null;
    if (a.data.length !== b.data.length) return null;

    let sumSquares = 0;
    for (let i = 0; i < a.data.length; i++) {
        const diff = a.data[i] - b.data[i];
        sumSquares += diff * diff;
    }
    const mse = sumSquares / a.data.length;
    if (mse === 0) return Number.POSITIVE_INFINITY;
    return 10 * Math.log10((255 * 255) / mse);
}

/** Mean absolute error normalized to 0..255 scale. */
export function meanAbsoluteError(a: { width: number; height: number; data: Uint8Array }, b: { width: number; height: number; data: Uint8Array }): number | null {
    if (a.width !== b.width || a.height !== b.height) return null;
    let sum = 0;
    for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]);
    return sum / a.data.length;
}

/**
 * Run the engine over every pair and score outputs against ground truth.
 * Per-item failures are isolated (reported, not thrown) unless
 * continueOnError is false.
 */
export async function runBenchmark(
    opts: BenchmarkOptions,
    imageAccess: ImageAccess = DefaultImageAccess,
): Promise<BenchmarkReport> {
    const scale = opts.scale ?? 2;
    await mkdir(opts.outDir, { recursive: true });
    const items: ItemBenchmark[] = [];

    for (const pair of opts.pairs) {
        const outPath = path.join(opts.outDir, `${pair.id}-upscaled.png`);
        try {
            const outcome = await runUpscale(
                { inputPath: pair.lrPath, outputPath: outPath, scale, model: opts.model, timeoutMs: opts.timeoutMs },
                opts.engine,
            );

            const [outputBytes, hrBytes] = await Promise.all([
                readFile(outcome.outputPath),
                readFile(pair.hrPath),
            ]);
            const [out, hr] = await Promise.all([
                imageAccess.decodeRgba(outputBytes),
                imageAccess.decodeRgba(hrBytes),
            ]);
            const psnrValue = psnr(out, hr);
            const mae = meanAbsoluteError(out, hr);
            items.push({ id: pair.id, psnr: psnrValue, mae, durationMs: outcome.durationMs });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (opts.continueOnError === false) throw new Error(`Benchmark failed on ${pair.id}: ${message}`);
            items.push({ id: pair.id, psnr: null, mae: null, durationMs: 0, error: message });
        }
    }

    const succeeded = items.filter((i) => i.psnr !== null);
    const psnrs = succeeded.map((i) => i.psnr as number).filter((p) => Number.isFinite(p));
    const finite = psnrs.length > 0 ? psnrs : null;

    return {
        items,
        aggregate: {
            count: items.length,
            succeeded: succeeded.length,
            failed: items.length - succeeded.length,
            meanPsnr: finite ? finite.reduce((s, p) => s + p, 0) / finite.length : null,
            minPsnr: finite ? Math.min(...finite) : null,
            maxPsnr: finite ? Math.max(...finite) : null,
            totalDurationMs: items.reduce((s, i) => s + i.durationMs, 0),
        },
    };
}
