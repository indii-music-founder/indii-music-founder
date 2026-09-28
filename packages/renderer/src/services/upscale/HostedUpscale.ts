/**
 * Browser fallback for a print-size image when the native super-resolution
 * engine is unavailable. This is a reference-guided 2K/4K regeneration, so
 * artists must review detail and lettering before approving a physical print.
 */
import { ImageGeneration } from '@/services/image/ImageGenerationService';

const RATIOS = [
    { label: '1:1', value: 1 }, { label: '4:5', value: 4 / 5 },
    { label: '3:4', value: 3 / 4 }, { label: '2:3', value: 2 / 3 },
    { label: '16:9', value: 16 / 9 }, { label: '9:16', value: 9 / 16 },
    { label: '4:3', value: 4 / 3 }, { label: '3:2', value: 3 / 2 },
] as const;

function closestAspect(width: number, height: number): string {
    const ratio = width / height;
    return RATIOS.reduce((best, candidate) =>
        Math.abs(candidate.value - ratio) < Math.abs(best.value - ratio) ? candidate : best,
    RATIOS[0]).label;
}

function imageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Cloud enhancement returned an unreadable image.'));
        image.src = url;
    });
}

export async function hostedUpscale(
    dataUrl: string,
    source: { width: number; height: number },
    required: { width: number; height: number },
): Promise<{ url: string; width: number; height: number }> {
    if (required.width > 5504 || required.height > 5504) {
        throw new Error('This target exceeds the cloud image size. Use the desktop engine or a printer-specific large-format workflow.');
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(dataUrl);
    if (!match) throw new Error('Cloud enhancement requires a PNG, JPEG, or WebP source image.');

    const imageSize = Math.max(required.width, required.height) <= 2048 ? '2k' : '4k';
    const results = await ImageGeneration.generateImages({
        prompt: 'Faithfully enhance the attached image for high-resolution print. Preserve the exact composition, subjects, objects, typography, colors, and framing. Add fine texture only where the reference supports it; do not add or remove design elements.',
        count: 1,
        model: 'pro',
        imageSize,
        aspectRatio: closestAspect(source.width, source.height),
        sourceImages: [{ mimeType: match[1]!, data: match[2]! }],
    });
    const url = results[0]?.url;
    if (!url) throw new Error('Cloud enhancement returned no image.');
    const dims = await imageDimensions(url);
    if (dims.width < required.width || dims.height < required.height) {
        throw new Error(`Cloud enhancement returned ${dims.width} × ${dims.height} px; ${required.width} × ${required.height} px is required.`);
    }
    return { url, ...dims };
}
