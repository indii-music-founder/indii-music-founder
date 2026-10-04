/** Tiled, on-device super-resolution. No generation, quota, or artwork prompt. */
import { runPrintStage } from './runPrintStage';
const MAX_OUTPUT_PIXELS = 80_000_000;
const PATCH = 128;
const PADDING = 12;

export interface BrowserUpscaleOptions {
    dataUrl: string;
    required: { width: number; height: number };
    onProgress?: (fraction: number) => void;
    onStage?: (stage: string) => void;
    signal?: AbortSignal;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read the artwork for enlargement.'));
        image.src = url;
    });
}

export async function browserUpscale({ dataUrl, required, onProgress, onStage, signal }: BrowserUpscaleOptions): Promise<{ url: string; width: number; height: number }> {
    const { width, height } = required;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_OUTPUT_PIXELS) {
        throw new Error('This output exceeds the browser’s 80 megapixel limit. Choose a smaller size or export a specific print target.');
    }
    onStage?.('Reading source pixels...');
    const source = await runPrintStage('Reading source pixels', 60_000, () => loadImage(dataUrl), signal);
    const factor = Math.max(width / source.naturalWidth, height / source.naturalHeight);
    if (factor > 4) throw new Error('This print needs more than a 4× enlargement. Upload a larger original or choose a lower supported print resolution.');
    const scale = factor <= 2 ? 2 : 4;
    onStage?.('Loading browser enhancement tools...');
    const [{ default: Upscaler }, tf, { default: model }] = await runPrintStage('Loading browser enhancement tools', 120_000, () => Promise.all([
        import('upscaler'), import('@tensorflow/tfjs'),
        scale === 2 ? import('@upscalerjs/esrgan-slim/2x') : import('@upscalerjs/esrgan-slim/4x'),
    ]), signal);
    onStage?.('Starting browser graphics...');
    await runPrintStage('Starting browser graphics', 60_000, () => tf.ready(), signal);
    const engine = new Upscaler({ model: { ...model, path: `${import.meta.env.BASE_URL}models/upscale/x${scale}/model.json` } });
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d');
    const cropWidth = width / factor;
    const cropHeight = height / factor;
    const cropX = (source.naturalWidth - cropWidth) / 2;
    const cropY = (source.naturalHeight - cropHeight) / 2;
    const cols = Math.ceil(cropWidth / PATCH);
    const rows = Math.ceil(cropHeight / PATCH);
    const patch = document.createElement('canvas');
    const patchContext = patch.getContext('2d');
    const pixels = document.createElement('canvas');
    try {
        if (!context || !patchContext) throw new Error('Could not allocate the print canvas.');
        onStage?.('Loading the enhancement model...');
        await runPrintStage('Loading the enhancement model', 120_000, () => engine.ready, signal);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                signal?.throwIfAborted();
                const x = col * PATCH;
                const y = row * PATCH;
                const w = Math.min(PATCH, cropWidth - x);
                const h = Math.min(PATCH, cropHeight - y);
                // Constant patch dimensions keep GPU shader compilation bounded.
                patch.width = PATCH + PADDING * 2;
                patch.height = PATCH + PADDING * 2;
                // Extend the edge pixels rather than surrounding the image with black.
                const startX = cropX + x - PADDING;
                const startY = cropY + y - PADDING;
                patchContext.drawImage(source, -startX, -startY);
                const leftPad = Math.max(0, -startX);
                const topPad = Math.max(0, -startY);
                const rightPad = Math.max(0, startX + patch.width - source.naturalWidth);
                const bottomPad = Math.max(0, startY + patch.height - source.naturalHeight);
                if (leftPad) patchContext.drawImage(source, 0, 0, 1, source.naturalHeight, 0, -startY, leftPad, source.naturalHeight);
                if (rightPad) patchContext.drawImage(source, source.naturalWidth - 1, 0, 1, source.naturalHeight, patch.width - rightPad, -startY, rightPad, source.naturalHeight);
                if (topPad) patchContext.drawImage(patch, 0, topPad, patch.width, 1, 0, 0, patch.width, topPad);
                if (bottomPad) patchContext.drawImage(patch, 0, patch.height - bottomPad - 1, patch.width, 1, 0, patch.height - bottomPad, patch.width, bottomPad);
                onStage?.(`Enhancing tile ${row * cols + col + 1} of ${rows * cols}...`);
                // We yield between our own bounded tiles. SDK animation-frame
                // waits can otherwise stop indefinitely in a background tab.
                const tensor = await runPrintStage('Enhancing a print tile', 60_000,
                    activeSignal => engine.execute(patch, { output: 'tensor', signal: activeSignal, awaitNextFrame: false }),
                    signal, lateTensor => lateTensor.dispose());
                try {
                    pixels.width = tensor.shape[1];
                    pixels.height = tensor.shape[0];
                    const integers = tf.tidy(() => tensor.round().toInt());
                    try {
                        await runPrintStage('Reading enhanced pixels', 60_000, () => tf.browser.toPixels(integers, pixels), signal);
                    } finally { integers.dispose(); }
                    // Draw one tile directly into the final canvas, never concatenate
                    // the full enhanced image into a hundreds-of-MB GPU tensor.
                    const left = Math.round(x * factor);
                    const top = Math.round(y * factor);
                    const right = Math.round((x + w) * factor);
                    const bottom = Math.round((y + h) * factor);
                    context.drawImage(pixels, PADDING * scale, PADDING * scale, w * scale, h * scale,
                        left, top, right - left, bottom - top);
                } finally { tensor.dispose(); }
                onProgress?.((row * cols + col + 1) / (rows * cols));
                await runPrintStage('Preparing the next print tile', 60_000,
                    () => new Promise<void>(resolve => setTimeout(resolve, 0)), signal);
            }
        }
        // Models operate on RGB; restore the exact source alpha so apparel
        // transparency is preserved instead of becoming a black rectangle.
        context.globalCompositeOperation = 'destination-in';
        context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
        context.globalCompositeOperation = 'source-over';
        signal?.throwIfAborted();
        const url = output.toDataURL('image/png');
        if (!url.startsWith('data:image/png;base64,')) throw new Error('The browser could not encode this print size.');
        return { url, width, height };
    } finally {
        engine.abort();
        // dispose() itself waits on ready. A stuck model load must not keep
        // the UI busy after cancellation or a stage deadline has rejected.
        void engine.ready.then(() => engine.dispose(), () => undefined).catch(() => undefined);
        output.width = output.height = patch.width = patch.height = pixels.width = pixels.height = 0;
    }
}
