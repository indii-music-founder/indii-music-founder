import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    exportMasterAsset,
    renderPreset,
    resolveFit,
    type ExportHost,
    type ExportCanvas,
    type MasterImage
} from '../AssetExporter';

// ---------------------------------------------------------------------------
// Mock infrastructure: no real canvas backend needed. The image mock
// delegates to ctx.drawImage so every 2D call is recorded in one place.
// ---------------------------------------------------------------------------

interface DrawRecord {
    args: number[];
    filter: string | null;
}

interface MockCtx {
    calls: DrawRecord[];
    filter: string | null;
    save(): void;
    restore(): void;
    drawImage(...args: number[]): void;
}

function makeMockCtx(): MockCtx {
    const calls: DrawRecord[] = [];
    return {
        calls,
        filter: null,
        save() { /* opens a filter scope; filter itself is tracked on the ctx */ },
        restore() { this.filter = null; },
        drawImage(...args: number[]) {
            calls.push({ args, filter: this.filter });
        }
    };
}

function makeMockImage(w = 3000, h = 3000): MasterImage {
    return {
        width: w,
        height: h,
        draw(ctx, dx, dy, dw, dh) { ctx.drawImage(null as unknown as CanvasImageSource, dx, dy, dw, dh); },
        drawRegion(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
            ctx.drawImage(null as unknown as CanvasImageSource, sx, sy, sw, sh, dx, dy, dw, dh);
        }
    };
}

interface MockCanvas {
    canvas: ExportCanvas;
    ctx: MockCtx;
    width: number;
    height: number;
}

function makeMockHost(image: MasterImage): { host: ExportHost; canvases: MockCanvas[] } {
    const canvases: MockCanvas[] = [];
    const host: ExportHost = {
        createCanvas(width, height) {
            const ctx = makeMockCtx();
            const canvas: ExportCanvas = {
                width,
                height,
                getContext: () => ctx as unknown as CanvasRenderingContext2D,
                toDataURL: (format: string) => {
                    // Encode canvas dims into the payload length so byte math is verifiable.
                    const payload = 'A'.repeat(Math.max(8, Math.round((width * height) / 10000)));
                    return `data:${format};base64,${payload}`;
                }
            };
            const mc: MockCanvas = { canvas, ctx, width, height };
            canvases.push(mc);
            return canvas;
        },
        loadImage: () => Promise.resolve(image),
        byteLength(dataUrl) {
            const b64 = dataUrl.split(',')[1] ?? '';
            return Math.floor((b64.length * 3) / 4);
        }
    };
    return { host, canvases };
}

// ---------------------------------------------------------------------------
// renderPreset unit checks (G1.3 geometry, per fit mode)
// ---------------------------------------------------------------------------

describe('renderPreset — cover fit', () => {
    it('fills the frame exactly with a cover crop of a square master into 9:16', () => {
        const image = makeMockImage(3000, 3000);
        const ctx = makeMockCtx();

        renderPreset(ctx as unknown as CanvasRenderingContext2D, { width: 1080, height: 1920 }, image, 'cover');

        expect(ctx.calls).toHaveLength(1);
        const [, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.calls[0]!.args;
        expect(dx).toBe(0);
        expect(dy).toBe(0);
        expect(dw).toBe(1080);
        expect(dh).toBe(1920);
        // Crop window: full 3000 height, 1687.5px wide band, centered.
        expect(sh).toBeCloseTo(3000, 6);
        expect(sw).toBeCloseTo(1687.5, 6);
        expect(sy).toBe(0);
        expect(sx).toBeCloseTo((3000 - 1687.5) / 2, 6);
    });

    it('honors a face anchor when cropping', () => {
        const image = makeMockImage(3000, 3000);
        const ctx = makeMockCtx();

        renderPreset(
            ctx as unknown as CanvasRenderingContext2D,
            { width: 1080, height: 1920 },
            image,
            'cover',
            [{ kind: 'face', box: { xmin: 0.2, ymin: 0.45, xmax: 0.3, ymax: 0.55 } }]
        );

        const [, sx] = ctx.calls[0]!.args;
        // Face center at 750px; window is 1687.5 wide; window must contain 750.
        expect(sx).toBeLessThan(750);
        expect(sx + 1687.5).toBeGreaterThan(750);
        expect(sx).toBeGreaterThanOrEqual(0);
    });
});

describe('renderPreset — contain-blur-pad fit', () => {
    it('composites a blurred cover backdrop, then the contained full artwork', () => {
        const image = makeMockImage(3000, 3000);
        const ctx = makeMockCtx();

        renderPreset(ctx as unknown as CanvasRenderingContext2D, { width: 1080, height: 1920 }, image, 'contain-blur-pad');

        expect(ctx.calls).toHaveLength(2);

        const backdrop = ctx.calls[0]!;
        expect(backdrop.filter).toBe('blur(32px)');
        const [, bx, by, bw, bh] = backdrop.args;
        // Backdrop covers the whole frame.
        expect(bw).toBeGreaterThanOrEqual(1080);
        expect(bh).toBeGreaterThanOrEqual(1920);
        expect(bx).toBeLessThanOrEqual(0);
        expect(by).toBeLessThanOrEqual(0);
        expect(bx + bw).toBeGreaterThanOrEqual(1080);
        expect(by + bh).toBeGreaterThanOrEqual(1920);

        // Foreground is the fully contained artwork, centered, filter cleared.
        const fg = ctx.calls[1]!;
        expect(fg.filter).toBeNull();
        const [, fx, fy, fw, fh] = fg.args;
        expect(fw).toBe(1080);   // square → 9:16: width is the constraint
        expect(fh).toBe(1080);
        expect(fx).toBe(0);
        expect(fy).toBeCloseTo((1920 - 1080) / 2, 6);
    });
});

// ---------------------------------------------------------------------------
// resolveFit (plan §12 fit rules)
// ---------------------------------------------------------------------------

describe('resolveFit', () => {
    it('defaults to contain-blur-pad for extreme aspect changes (> 1.6×)', () => {
        expect(resolveFit({ dimensionId: 'ig_story' }, 3000, 3000, 1080, 1920)).toBe('contain-blur-pad');
    });

    it('defaults to cover for mild aspect changes', () => {
        expect(resolveFit({ dimensionId: 'square' }, 3000, 3000, 3000, 3000)).toBe('cover');
        expect(resolveFit({ dimensionId: 'facebook_og' }, 1920, 1080, 1200, 630)).toBe('cover');
    });

    it('respects an explicit preset fit override', () => {
        expect(resolveFit({ dimensionId: 'ig_story', fit: 'cover' }, 3000, 3000, 1080, 1920)).toBe('cover');
        expect(resolveFit({ dimensionId: 'square', fit: 'contain-blur-pad' }, 1000, 1000, 1000, 1000)).toBe('contain-blur-pad');
    });
});

// ---------------------------------------------------------------------------
// exportMasterAsset end-to-end through the mock host
// ---------------------------------------------------------------------------

describe('exportMasterAsset (G1.3 — through the mock host)', () => {
    it('produces one exact-dimension result per preset at 2× master scale', async () => {
        // 2000×2000 master, exercising three target dims.
        const image = makeMockImage(2000, 2000);
        const { host, canvases } = makeMockHost(image);

        const results = await exportMasterAsset({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: [
                { dimensionId: 'square', fit: 'cover' },        // 1080×1080
                { dimensionId: 'landscape', fit: 'cover' },     // 1920×1080
                { dimensionId: 'ig_story' }                     // 1080×1920 — extreme → blur-pad
            ]
        }, host);

        expect(results).toHaveLength(3);

        const [square, landscape, story] = results;
        expect(square!.platformId).toBe('square');
        expect(square!.width).toBe(1080);
        expect(square!.height).toBe(1080);
        expect(square!.fit).toBe('cover');

        expect(landscape!.platformId).toBe('landscape');
        expect(landscape!.width).toBe(1920);
        expect(landscape!.height).toBe(1080);

        expect(story!.platformId).toBe('ig_story');
        expect(story!.width).toBe(1080);
        expect(story!.height).toBe(1920);
        expect(story!.fit).toBe('contain-blur-pad'); // default rule kicked in

        // One canvas created per result, with exact dims.
        expect(canvases.map(c => [c.width, c.height])).toEqual([
            [1080, 1080],
            [1920, 1080],
            [1080, 1920]
        ]);

        // Each canvas actually rendered, blur-pad on the extreme one.
        expect(canvases[2]!.ctx.calls).toHaveLength(2); // backdrop + foreground
        expect(canvases[2]!.ctx.calls[0]!.filter).toBe('blur(32px)');

        // Bytes are derived from the data URL payload.
        for (const r of results) {
            expect(r.bytes).toBeGreaterThan(0);
            expect(r.url).toMatch(/^data:image\/png;base64,/);
        }
    });

    it('skips unknown dimensionIds but fails when nothing matches', async () => {
        const { host } = makeMockHost(makeMockImage(1000, 1000));

        const results = await exportMasterAsset({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: [{ dimensionId: 'square' }, { dimensionId: 'nope_404' }]
        }, host);
        expect(results).toHaveLength(1);

        await expect(exportMasterAsset({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: [{ dimensionId: 'nope_404' }]
        }, host)).rejects.toThrow(/no presets matched/i);
    });

    it('rejects empty requests up front', async () => {
        const { host } = makeMockHost(makeMockImage(1000, 1000));
        await expect(exportMasterAsset({ masterUrl: '', presets: [{ dimensionId: 'square' }] }, host))
            .rejects.toThrow(/masterUrl/);
        await expect(exportMasterAsset({ masterUrl: 'data:image/png;base64,QUJD', presets: [] }, host))
            .rejects.toThrow(/at least one preset/);
    });
});

// ---------------------------------------------------------------------------
// G1.4 — structural lint guard: AssetExporter.ts must never import Fabric.
// ---------------------------------------------------------------------------

describe('G1.4 fabric import guard', () => {
    it('AssetExporter.ts contains no fabric import or reference', () => {
        const src = readFileSync(resolve(process.cwd(), 'packages/renderer/src/services/export/AssetExporter.ts'), 'utf8');
        expect(src).not.toMatch(/from\s+['"][^'"]*fabric/i);
        expect(src).not.toMatch(/import\(\s*['"][^'"]*fabric/i);
        // No dynamic fabric usage either (require / namespace access).
        expect(src).not.toMatch(/require\(\s*['"][^'"]*fabric/i);
    });
});

// ---------------------------------------------------------------------------
// ISSUE-322 — print-target presets: exact px + DPI triple, byte-level proof.
// ---------------------------------------------------------------------------

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function makeTinyPngDataUrl(): string {
    // Minimal PNG-shaped stream: signature + IHDR + IEND with valid CRCs.
    const table = new Array<number>(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    const crc = (bytes: Uint8Array): number => {
        let c = 0xffffffff;
        for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type: string, payload: Uint8Array): Uint8Array => {
        const out = new Uint8Array(12 + payload.length);
        const v = new DataView(out.buffer);
        v.setUint32(0, payload.length);
        for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
        out.set(payload, 8);
        const input = new Uint8Array(4 + payload.length);
        for (let i = 0; i < 4; i++) input[i] = out[4 + i];
        input.set(payload, 4);
        v.setUint32(8 + payload.length, crc(input));
        return out;
    };
    const ihdr = new Uint8Array(13);
    const sig = Uint8Array.from(PNG_SIG);
    const parts = [sig, chunk('IHDR', ihdr), chunk('IEND', new Uint8Array(0))];
    const png = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let off = 0;
    for (const p of parts) { png.set(p, off); off += p.length; }
    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

function makePrintHost(image: MasterImage) {
    const created: { width: number; height: number }[] = [];
    const pngUrl = makeTinyPngDataUrl();
    const host: ExportHost = {
        createCanvas(width, height) {
            created.push({ width, height });
            return {
                width,
                height,
                getContext: () => makeMockCtx() as unknown as CanvasRenderingContext2D,
                toDataURL: () => pngUrl
            };
        },
        loadImage: () => Promise.resolve(image),
        byteLength: (dataUrl) => Math.floor(((dataUrl.split(',')[1] ?? '').length * 3) / 4)
    };
    return { host, created, pngUrl };
}

function walkTypes(bytes: Uint8Array): string[] {
    const types: string[] = [];
    let off = 8;
    while (off + 12 <= bytes.length) {
        const len = (bytes[off] << 24 | bytes[off + 1] << 16 | bytes[off + 2] << 8 | bytes[off + 3]) >>> 0;
        types.push(String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]));
        off += 12 + len;
    }
    return types;
}

describe('exportMasterAsset — print targets (ISSUE-322)', () => {
    it('renders at the exact print-plan pixels and tags the file bytes with DPI', async () => {
        const image = makeMockImage(2048, 2048);
        const { host, created, pngUrl } = makePrintHost(image);

        const results = await exportMasterAsset(
            { masterUrl: 'data:image/png;base64,QUJD', presets: [{ dimensionId: 'any', printPresetId: 'cover_art_distributor' }] },
            host
        );

        expect(results).toHaveLength(1);
        expect(created[0]).toEqual({ width: 3000, height: 3000 }); // PrintSpec plan, not platform registry
        expect(results[0]!.width).toBe(3000);
        expect(results[0]!.height).toBe(3000);
        expect(results[0]!.dpi).toBe(300);
        expect(results[0]!.platformId).toBe('print:cover_art_distributor');

        // Decode the RESULT's bytes — pHYs must exist in the file itself.
        const outBytes = Buffer.from(results[0]!.url.split(',')[1], 'base64');
        expect(outBytes[0]).toBe(PNG_SIG[0]);
        expect(walkTypes(new Uint8Array(outBytes))).toContain('pHYs');
        expect(results[0]!.url).not.toBe(pngUrl); // rewritten, not passthrough
    });

    it('leaves non-print exports byte-identical to the canvas output', async () => {
        const image = makeMockImage(3000, 3000);
        const { host, created, pngUrl } = makePrintHost(image);
        created.length = 0;

        const results = await exportMasterAsset(
            { masterUrl: 'data:image/png;base64,QUJD', presets: [{ dimensionId: 'square', fit: 'cover' }] },
            host
        );

        expect(results[0]!.dpi).toBeUndefined();
        expect(results[0]!.url).toBe(pngUrl); // untouched
        expect(created[0]!.width).toBe(1080); // platform registry dimension ('square'), unchanged flow
    });

    it('rejects a print target on a format without a density container', async () => {
        const image = makeMockImage(2048, 2048);
        const { host } = makePrintHost(image);
        await expect(exportMasterAsset(
            { masterUrl: 'x', format: 'image/webp', presets: [{ dimensionId: 'any', printPresetId: 'vinyl_sleeve' }] },
            host
        )).rejects.toThrow(/requires PNG or JPEG/);
    });
});
