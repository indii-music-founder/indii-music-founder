/**
 * PairedSynthesis — training-pair synthesis for the domain upscaler
 * (ISSUE-329 phase 1, zero-spend).
 *
 * indii's own 4K generations are the high-resolution ground truth. Each pair
 * is synthesized by JPEG-degrading the HR source at full resolution, then
 * downsampling by an integer factor — approximating the compressed, smaller
 * sources the engine will meet in production.
 *
 * The canvas factory is injected (node-canvas in real runs) so tests stay
 * deterministic and dependency-light; all outputs are reproducible.
 */

export interface SynthesisImage {
    width: number;
    height: number;
    /** Drawable by a 2D context (node-canvas Image satisfies this). */
    readonly drawable: unknown;
}

export interface SynthesisCanvasFactory {
    createCanvas(width: number, height: number): {
        width: number;
        height: number;
        getContext(kind: '2d'): unknown;
        toBuffer(format: 'image/png'): Buffer;
        toBuffer(format: 'image/jpeg', opts: { quality?: number }): Buffer;
    };
    loadImage(source: Buffer): Promise<SynthesisImage>;
}

export interface PairOptions {
    /** HR source bytes (PNG/JPEG). */
    hr: Buffer;
    /** Integer downsample factor (2 or 4 typical). */
    factor: number;
    /** JPEG compression quality for degradation (0..1). Default 0.75. */
    jpegQuality?: number;
}

export interface SynthesizedPair {
    /** Low-resolution (degraded) input as PNG bytes. */
    lrPng: Buffer;
    width: number;
    height: number;
    factor: number;
}

export const DEFAULT_JPEG_QUALITY = 0.75;

/**
 * Synthesize one training pair from HR source bytes.
 * LR dims = ceil(hr / factor) so odd sizes stay integer.
 * Pipeline: HR → JPEG(loss q) → downsample → LR PNG.
 */
export async function synthesizePair(
    opts: PairOptions,
    factory: SynthesisCanvasFactory,
): Promise<SynthesizedPair> {
    if (!Number.isInteger(opts.factor) || opts.factor < 2) {
        throw new Error('PairedSynthesis: factor must be an integer >= 2');
    }
    if (opts.jpegQuality !== undefined && !(opts.jpegQuality > 0 && opts.jpegQuality <= 1)) {
        throw new Error('PairedSynthesis: jpegQuality must be in (0, 1]');
    }

    const hr = await factory.loadImage(opts.hr);
    if (hr.width < 8 || hr.height < 8) {
        throw new Error('PairedSynthesis: source too small (min 8px per side)');
    }

    // Step 1 — full-resolution codec loss.
    const jpegCanvas = factory.createCanvas(hr.width, hr.height);
    const jctx = jpegCanvas.getContext('2d') as CanvasRenderingContext2D;
    jctx.drawImage(hr.drawable as CanvasImageSource, 0, 0);
    const jpegBytes = jpegCanvas.toBuffer('image/jpeg', { quality: opts.jpegQuality ?? DEFAULT_JPEG_QUALITY });

    // Step 2 — decode the degraded JPEG, downsample into the LR canvas.
    const degraded = await factory.loadImage(jpegBytes);
    const lrW = Math.ceil(hr.width / opts.factor);
    const lrH = Math.ceil(hr.height / opts.factor);
    const lrCanvas = factory.createCanvas(lrW, lrH);
    const lctx = lrCanvas.getContext('2d') as CanvasRenderingContext2D;
    lctx.drawImage(
        degraded.drawable as CanvasImageSource,
        0, 0, degraded.width, degraded.height,
        0, 0, lrW, lrH,
    );

    return { lrPng: lrCanvas.toBuffer('image/png'), width: lrW, height: lrH, factor: opts.factor };
}

// ---------------------------------------------------------------------------
// Deterministic split
// ---------------------------------------------------------------------------

export interface SplitRatios {
    train: number;
    val: number;
    test: number;
}

export const DEFAULT_SPLIT_RATIOS: SplitRatios = { train: 0.8, val: 0.1, test: 0.1 };

/** Small deterministic PRNG (mulberry32) — same seed, same shuffle, forever. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type SplitName = 'train' | 'val' | 'test';

/**
 * Assign each entry a dataset split via a seeded, reproducible shuffle.
 * Deterministic: identical inputs + seed → identical assignment.
 */
export function buildSplit<T>(
    entries: T[],
    seed: number,
    ratios: SplitRatios = DEFAULT_SPLIT_RATIOS,
): Record<SplitName, T[]> {
    const total = ratios.train + ratios.val + ratios.test;
    if (Math.abs(total - 1) > 1e-6) throw new Error('PairedSynthesis: split ratios must sum to 1');

    const shuffled = entries
        .map((entry, order) => ({ entry, key: mulberry32(seed + order * 7919)() }))
        .sort((p, q) => p.key - q.key)
        .map((x) => x.entry);

    const trainCount = Math.floor(entries.length * ratios.train);
    const valCount = Math.floor(entries.length * ratios.val);
    return {
        train: shuffled.slice(0, trainCount),
        val: shuffled.slice(trainCount, trainCount + valCount),
        test: shuffled.slice(trainCount + valCount),
    };
}
