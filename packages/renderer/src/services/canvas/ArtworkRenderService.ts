import { artworkTransform, artworkExportDimensions } from './ArtworkGeometry';
export { artworkTransform } from './ArtworkGeometry';
import * as fabric from 'fabric';
import { auth } from '@/services/firebase';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { adjustmentsToFilters, type CanvasDoc, type CanvasLayer, type RasterLayer } from './CanvasDoc';
import { descriptorsToFabricFilters } from './fabricFilters';
import { rasterizeTextLayer } from './textLayerRaster';
import { adjustArtworkPixels, applyArtworkMask, effectiveAdjustments, finishArtworkPixels } from './ArtworkPixels';

function surface(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    return canvas;
}
function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Photo rendering is unavailable');
    return ctx;
}
export async function loadArtworkImage(src: string, signal?: AbortSignal): Promise<fabric.FabricImage> {
    const url = await resolveStorageUrl(src);
    signal?.throwIfAborted();
    return fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous', signal });
}
async function pixelPass(canvas: HTMLCanvasElement, layer: RasterLayer, phase: 'mask' | 'color' | 'finish', signal: AbortSignal, maskData?: Uint8ClampedArray, originalAlpha?: Uint8Array): Promise<void> {
    signal.throwIfAborted();
    const ctx = context(canvas);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
        let worker: Worker;
        try { worker = new Worker(new URL('./ArtworkPixelWorker.ts', import.meta.url), { type: 'module' }); }
        catch { resolve(null); return; }
        const timer = setTimeout(() => { finish(); resolve(null); }, 30_000);
        const finish = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', cancel); };
        const cancel = () => { finish(); reject(new DOMException('Photo processing cancelled', 'AbortError')); };
        signal.addEventListener('abort', cancel, { once: true });
        worker.onerror = () => { finish(); resolve(null); };
        worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
            finish();
            if (event.data.buffer) resolve(event.data.buffer);
            else reject(new Error(event.data.error ?? 'Photo processing failed'));
        };
        try {
            worker.postMessage({ buffer: image.data.buffer, maskBuffer: maskData?.buffer, originalAlphaBuffer: originalAlpha?.buffer, width: canvas.width, height: canvas.height, layer, phase }, [image.data.buffer as ArrayBuffer]);
        } catch {
            finish(); resolve(null);
        }
    });
    signal.throwIfAborted();
    if (result) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(result), canvas.width, canvas.height), 0, 0);
        return;
    }
    // Some browsers reject module workers despite serving the script. Process the same
    // pixels on the main thread so the cover remains editable and exportable.
    const fallback = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (phase === 'mask') {
        if (!maskData) throw new Error('Cutout mask pixels are missing');
        applyArtworkMask(fallback.data, maskData, originalAlpha);
    } else if (phase === 'color') adjustArtworkPixels(fallback.data, layer);
    else finishArtworkPixels(fallback.data, canvas.width, canvas.height, layer);
    ctx.putImageData(fallback, 0, 0);
}

interface RenderEntry { promise: Promise<HTMLCanvasElement>; controller: AbortController; consumers: Set<symbol>; settled: boolean }
const renders = new Map<string, RenderEntry>();
const sizes = new Map<string, number>();
const densities = new WeakMap<HTMLCanvasElement, number>();
export function artworkSourceDensity(source: HTMLCanvasElement): number { return densities.get(source) ?? 1; }
function trimCache(): void {
    let total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
    for (const key of renders.keys()) {
        if (renders.size <= 4 && total <= 24_000_000) break;
        const entry = renders.get(key)!;
        if (!entry.settled || entry.consumers.size) continue;
        total -= sizes.get(key) ?? 0;
        renders.delete(key); sizes.delete(key);
    }
}

function consume(entry: RenderEntry, signal?: AbortSignal): Promise<HTMLCanvasElement> {
    if (signal?.aborted) return Promise.reject(new DOMException('Rendering cancelled', 'AbortError'));
    const consumer = Symbol(); entry.consumers.add(consumer);
    return new Promise((resolve, reject) => {
        const release = () => {
            signal?.removeEventListener('abort', cancel);
            entry.consumers.delete(consumer);
            if (!entry.settled && !entry.consumers.size) entry.controller.abort();
            trimCache();
        };
        const cancel = () => { release(); reject(new DOMException('Rendering cancelled', 'AbortError')); };
        signal?.addEventListener('abort', cancel, { once: true });
        void entry.promise.then(result => { release(); resolve(result); }, failure => { release(); reject(failure); });
    });
}

/** Bake intrinsic photo/text pixels once; transforms and layer alpha remain editable. */
export async function renderArtworkSource(layer: CanvasLayer, signal?: AbortSignal, outputScale = 1): Promise<HTMLCanvasElement> {
    const density = layer.kind === 'text' ? Math.max(1, Math.abs(layer.scaleX * outputScale), Math.abs(layer.scaleY * outputScale)) : 1;
    const scope = auth.currentUser?.uid ?? 'local';
    const key = layer.kind === 'text' ? JSON.stringify({ scope, typography: layer.typography, scale: layer.rasterScale, density }) : JSON.stringify({
        scope, src: layer.src, mask: layer.maskSrc, feather: layer.maskFeather, adjustments: layer.adjustments,
        version: layer.adjustmentVersion, look: layer.look, grain: layer.grain,
    });
    const existing = renders.get(key);
    if (existing && !existing.controller.signal.aborted) return consume(existing, signal);
    const controller = new AbortController();
    const pending = (async () => {
        if (layer.kind === 'text' && !layer.typography.text) return surface(1, 1);
        const image = await loadArtworkImage(layer.kind === 'text' ? (await rasterizeTextLayer(layer, (layer.rasterScale ?? 1) * density)).dataUrl : layer.src, controller.signal);
        const width = image.width, height = image.height;
        if (!width || !height || width * height > 24_000_000) throw new Error('This layer is too large. Reduce the photo dimensions or text size before editing.');
        const canvas = surface(width, height), ctx = context(canvas);
        ctx.drawImage(image.getElement(), 0, 0);
        if (layer.kind === 'raster') {
            const applyMask = async (originalAlpha?: Uint8Array) => {
                if (!layer.maskSrc) return;
                const mask = await loadArtworkImage(layer.maskSrc, controller.signal);
                if (mask.width !== width || mask.height !== height) throw new Error('Cutout dimensions do not match the original photo');
                const maskCanvas = surface(width, height), maskCtx = context(maskCanvas);
                maskCtx.filter = `blur(${layer.maskFeather ?? 1}px)`;
                maskCtx.drawImage(mask.getElement(), 0, 0);
                const maskData = maskCtx.getImageData(0, 0, width, height).data;
                await pixelPass(canvas, layer, 'mask', controller.signal, maskData, originalAlpha);
                maskCanvas.width = 0; maskCanvas.height = 0;
            };
            if (layer.adjustmentVersion !== 2) {
                let originalAlpha: Uint8Array | undefined;
                if (layer.maskSrc) {
                    const pixels = ctx.getImageData(0, 0, width, height).data;
                    originalAlpha = new Uint8Array(width * height);
                    for (let i = 0; i < originalAlpha.length; i++) originalAlpha[i] = pixels[i * 4 + 3]!;
                }
                const legacy = new fabric.FabricImage(canvas);
                legacy.filters = descriptorsToFabricFilters(adjustmentsToFilters(layer.adjustments));
                if (legacy.filters.length) {
                    legacy.applyFilters();
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(legacy.getElement(), 0, 0);
                }
                legacy.dispose();
                await applyMask(originalAlpha);
            } else {
                await applyMask();
                const adjustments = effectiveAdjustments(layer);
                if (adjustments.brightness || adjustments.contrast || adjustments.saturation || adjustments.hue || adjustments.temperature || adjustments.exposure) {
                    await pixelPass(canvas, layer, 'color', controller.signal);
                }
                const blur = effectiveAdjustments(layer).blur * 20;
                if (blur) {
                    const blurred = surface(width, height), blurCtx = context(blurred);
                    blurCtx.filter = `blur(${blur}px)`; blurCtx.drawImage(canvas, 0, 0);
                    ctx.clearRect(0, 0, width, height); ctx.drawImage(blurred, 0, 0);
                }
                if (layer.grain?.amount || layer.adjustments.vignette) await pixelPass(canvas, layer, 'finish', controller.signal);
            }
        }
        densities.set(canvas, density);
        sizes.set(key, width * height); trimCache();
        return canvas;
    })();
    const entry: RenderEntry = { controller, consumers: new Set(), settled: false, promise: pending };
    renders.set(key, entry);
    trimCache();
    void pending.then(() => { entry.settled = true; trimCache(); }, () => {
        entry.settled = true;
        if (renders.get(key) === entry) { renders.delete(key); sizes.delete(key); }
    });
    return consume(entry, signal);
}

/** Export from full-resolution sources after every required resource has loaded. */
export async function renderArtworkDocument(doc: CanvasDoc, scale = 1, jpeg = false): Promise<HTMLCanvasElement> {
    const { width, height } = artworkExportDimensions(doc, scale);
    const canvas = surface(width, height), ctx = context(canvas);
    if (doc.background !== 'transparent' || jpeg) {
        ctx.fillStyle = doc.background === 'transparent' ? '#000000' : doc.background;
        ctx.fillRect(0, 0, width, height);
    }
    for (const layer of doc.layers) {
        if (!layer.visible) continue;
        const source = await renderArtworkSource(layer, undefined, scale);
        const density = artworkSourceDensity(source);
        const t = artworkTransform(layer, source.width / density, source.height / density, doc);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = doc.renderVersion === 1 || layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
        ctx.translate(t.x * scale, t.y * scale); ctx.rotate(t.rotation * Math.PI / 180); ctx.scale(t.scaleX * scale / density, t.scaleY * scale / density);
        ctx.drawImage(source, 0, 0); ctx.restore();
    }
    return canvas;
}

/** Bake one positioned layer into its clipped document bounds for layered PSD export. */
export async function renderPositionedArtworkLayer(layer: CanvasLayer, doc: CanvasDoc, scale = 1) {
    const output = artworkExportDimensions(doc, scale);
    const source = await renderArtworkSource(layer, undefined, scale);
    const density = artworkSourceDensity(source);
    const t = artworkTransform(layer, source.width / density, source.height / density, doc);
    const radians = t.rotation * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const corners = [[0, 0], [source.width, 0], [0, source.height], [source.width, source.height]].map(([x, y]) => ({
        x: (t.x + x! / density * t.scaleX * cos - y! / density * t.scaleY * sin) * scale,
        y: (t.y + x! / density * t.scaleX * sin + y! / density * t.scaleY * cos) * scale,
    }));
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))));
    const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))));
    const right = Math.min(output.width, Math.ceil(Math.max(...corners.map(p => p.x))));
    const bottom = Math.min(output.height, Math.ceil(Math.max(...corners.map(p => p.y))));
    const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
    const canvas = surface(width, height), ctx = context(canvas);
    if (right > left && bottom > top) {
        ctx.translate(t.x * scale - left, t.y * scale - top); ctx.rotate(radians); ctx.scale(t.scaleX * scale / density, t.scaleY * scale / density);
        ctx.drawImage(source, 0, 0);
    }
    return { left, top, width, height, data: ctx.getImageData(0, 0, width, height).data };
}
