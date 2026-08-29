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
