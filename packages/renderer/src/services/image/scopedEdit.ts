import { CloudStorageService } from '@/services/CloudStorageService';
import { applyMaskedPixels, maskContextCrop } from './scopedEditPixels';

type InlineImage = { mimeType: string; data: string };
function inlineImage(canvas: HTMLCanvasElement): InlineImage {
    return { mimeType: 'image/png', data: canvas.toDataURL('image/png').split(',')[1]! };
}
function surface(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the selected edit area.');
    return { canvas, context };
}
async function bitmap(image: InlineImage) {
    return createImageBitmap(await CloudStorageService.dataURItoBlob(`data:${image.mimeType};base64,${image.data}`));
}

/** Focus a chained edit on its region and preserve every unmarked pixel. */
export async function prepareScopedEdit(image: InlineImage, mask: InlineImage) {
    const source = await bitmap(image);
    const selection = await bitmap(mask);
    try {
        if (selection.width !== source.width || selection.height !== source.height) throw new Error('The edit mask is not aligned with this image.');
        const base = surface(source.width, source.height);
        base.context.drawImage(source, 0, 0);
        const selected = surface(source.width, source.height);
        selected.context.drawImage(selection, 0, 0);
        const original = base.context.getImageData(0, 0, source.width, source.height);
        const maskPixels = selected.context.getImageData(0, 0, source.width, source.height);
        const crop = maskContextCrop(maskPixels.data, source.width, source.height);
        const width = crop.size || source.width, height = crop.size || source.height;
        // Tiny detail crops otherwise invite the model to reconstruct/reframe
        // the photograph. Present the detail and its aligned mask at a useful
        // resolution; the returned pixels still map to the original region.
        const inputWidth = crop.size ? Math.max(1024, width) : width;
        const inputHeight = crop.size ? inputWidth : height;
        const input = surface(inputWidth, inputHeight), guide = surface(inputWidth, inputHeight);
        input.context.drawImage(base.canvas, crop.left, crop.top, width, height, 0, 0, inputWidth, inputHeight);
        guide.context.imageSmoothingEnabled = false;
        guide.context.drawImage(selected.canvas, crop.left, crop.top, width, height, 0, 0, inputWidth, inputHeight);
        return {
            image: inlineImage(input.canvas), mask: inlineImage(guide.canvas),
            aspectRatio: crop.size ? '1:1' : undefined,
            framingInstruction: crop.size
                ? 'The supplied image is an enlarged square DETAIL CROP from a larger canvas. Return this exact detail crop with the same framing, scale, and pixel locations. Do not reconstruct the full photograph, zoom out, recenter, or move content. References to other parts of the photograph mean leave them untouched, not draw them into this crop. Place the requested change inside the white region of the aligned mask.'
                : '',
            async composite(result: InlineImage): Promise<InlineImage> {
                const generated = await bitmap(result);
                try {
                    base.context.drawImage(generated, crop.left, crop.top, width, height);
                    const replacement = base.context.getImageData(0, 0, original.width, original.height);
                    replacement.data.set(applyMaskedPixels(original.data, replacement.data, maskPixels.data));
                    base.context.putImageData(replacement, 0, 0);
                    return inlineImage(base.canvas);
                } finally { generated.close(); }
            },
        };
    } finally { source.close(); selection.close(); }
}
