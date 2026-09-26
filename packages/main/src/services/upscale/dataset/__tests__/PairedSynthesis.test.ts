/**
 * PairedSynthesis tests (ISSUE-329 phase 1).
 *
 * Uses the REAL node-canvas module (root dependency) — pixel dims and buffer
 * properties are verified against actual encodes, not mocks.
 */

import { createCanvas, loadImage } from 'canvas';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_SPLIT_RATIOS,
    buildSplit,
    mulberry32,
    synthesizePair,
    type SynthesisCanvasFactory,
} from '../PairedSynthesis';

// node-canvas Image satisfies { width, height, drawable } structurally.
const realFactory: SynthesisCanvasFactory = {
    createCanvas: (width, height) => createCanvas(width, height),
    loadImage: (source) => loadImage(source).then((img) => ({ width: img.width, height: img.height, drawable: img })),
};

async function makeHrBuffer(width = 64, height = 64): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ff0044');
    gradient.addColorStop(1, '#0044ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
    return canvas.toBuffer('image/png');
}

describe('synthesizePair — real canvas', () => {
    it('produces an LR PNG at ceil(hr / factor) dimensions', async () => {
        const hr = await makeHrBuffer(64, 48);
        const pair = await synthesizePair({ hr, factor: 4 }, realFactory);
        expect(pair.width).toBe(16);
        expect(pair.height).toBe(12);
        // PNG signature
        expect([...pair.lrPng.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
        // LR is smaller than HR bytes (downsampled + recompressed)
        expect(pair.lrPng.byteLength).toBeLessThan(hr.byteLength);
    });

    it('ceil keeps odd dimensions integral', async () => {
        const hr = await makeHrBuffer(45, 33);
        const pair = await synthesizePair({ hr, factor: 4 }, realFactory);
        expect(pair.width).toBe(12); // ceil(45/4)
        expect(pair.height).toBe(9); // ceil(33/4)
    });

    it('is deterministic: same input, same bytes', async () => {
        const hr = await makeHrBuffer(32, 32);
        const a = await synthesizePair({ hr, factor: 2, jpegQuality: 0.8 }, realFactory);
        const b = await synthesizePair({ hr, factor: 2, jpegQuality: 0.8 }, realFactory);
        expect(a.lrPng.equals(b.lrPng)).toBe(true);
    });

    it('lower jpegQuality changes the degraded output', async () => {
        const hr = await makeHrBuffer(64, 64);
        const hi = await synthesizePair({ hr, factor: 2, jpegQuality: 0.95 }, realFactory);
        const lo = await synthesizePair({ hr, factor: 2, jpegQuality: 0.3 }, realFactory);
        expect(hi.lrPng.equals(lo.lrPng)).toBe(false);
    });

    it('rejects invalid factors, qualities, and tiny sources', async () => {
        const hr = await makeHrBuffer(16, 16);
        expect(synthesizePair({ hr, factor: 1.5 as 2 }, realFactory)).rejects.toThrow(/integer/);
        expect(synthesizePair({ hr, factor: 2, jpegQuality: 1.5 }, realFactory)).rejects.toThrow(/jpegQuality/);
        expect(synthesizePair({ hr: Buffer.alloc(4), factor: 2 }, realFactory)).rejects.toThrow(/Unsupported image type|too small/i);
    });
});

describe('buildSplit — deterministic assignment', () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({ id: `gen-${i}` }));

    it('assigns every entry exactly once with the configured ratios', () => {
        const split = buildSplit(entries, 42);
        const all = [...split.train, ...split.val, ...split.test];
        expect(all).toHaveLength(entries.length);
        expect(new Set(all.map((e) => e.id)).size).toBe(entries.length);
        expect(split.train.length).toBe(40); // floor(50 * 0.8)
        expect(split.val.length).toBe(5);
        expect(split.test.length).toBe(5);
    });

    it('same seed reproduces the same split; different seed differs', () => {
        const a = buildSplit(entries, 42);
        const b = buildSplit(entries, 42);
        const c = buildSplit(entries, 43);
        expect(a.train.map((e) => e.id)).toEqual(b.train.map((e) => e.id));
        expect(a.train.map((e) => e.id)).not.toEqual(c.train.map((e) => e.id));
    });

    it('rejects ratios that do not sum to 1', () => {
        expect(() => buildSplit(entries, 1, { train: 0.5, val: 0.5, test: 0.5 })).toThrow(/sum to 1/);
        expect(DEFAULT_SPLIT_RATIOS).toEqual({ train: 0.8, val: 0.1, test: 0.1 });
    });
});

describe('mulberry32', () => {
    it('is reproducible for a given seed', () => {
        const r1 = mulberry32(7);
        const r2 = mulberry32(7);
        expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
    });
});
