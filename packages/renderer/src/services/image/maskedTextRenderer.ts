import { CloudStorageService } from '@/services/CloudStorageService';
import { applyMaskedPixels } from './scopedEditPixels';
import { textContrastColor, textFitsMask, textMaskBounds, type MaskedTextCandidate } from './maskedTextEdit';

type InlineImage = { mimeType: string; data: string };
function surface(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not render the requested text.');
    return { canvas, context };
}
async function bitmap(image: InlineImage) {
    return createImageBitmap(await CloudStorageService.dataURItoBlob(`data:${image.mimeType};base64,${image.data}`));
}

/** Render approved literal lettering with real fonts; preserve every unmarked pixel. */
export async function renderMaskedText(image: InlineImage, mask: InlineImage, plan: MaskedTextCandidate): Promise<InlineImage> {
    const source = await bitmap(image);
    let selection: ImageBitmap | undefined;
    try {
        selection = await bitmap(mask);
        if (source.width !== selection.width || source.height !== selection.height) throw new Error('The text mask is not aligned with this image.');
        const base = surface(source.width, source.height), guide = surface(source.width, source.height);
        base.context.drawImage(source, 0, 0); guide.context.drawImage(selection, 0, 0);
        const original = base.context.getImageData(0, 0, source.width, source.height);
        const maskPixels = guide.context.getImageData(0, 0, source.width, source.height);
        const bounds = textMaskBounds(maskPixels.data, source.width, source.height);
        if (!bounds) throw new Error('Paint an area before adding text.');
        const font = (size: number) => `${plan.italic ? 'italic ' : ''}${plan.bold ? 'bold ' : ''}${size}px "${plan.fontFamily}"`;
        await document.fonts.load(font(100), plan.text);
        base.context.font = font(100);
        const measured = base.context.measureText(plan.text);
        const measuredHeight = measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent;
        if (!(measured.width > 0 && measuredHeight > 0)) throw new Error('The requested text has no visible characters.');
        const size = Math.min(bounds.width * 0.8 / measured.width, bounds.height * 0.72 / measuredHeight) * 100;
        if (!Number.isFinite(size) || size < 1) throw new Error('Paint a larger area for readable text.');
        if (plan.background) {
            base.context.fillStyle = plan.background;
            base.context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
        }
        const lettering = surface(source.width, source.height);
        lettering.context.font = font(size);
        lettering.context.fillStyle = plan.fill === 'auto'
            ? textContrastColor(plan.background ? base.context.getImageData(0, 0, source.width, source.height).data : original.data, maskPixels.data)
            : plan.fill;
        lettering.context.textAlign = 'center';
        lettering.context.textBaseline = 'alphabetic';
        const metrics = lettering.context.measureText(plan.text);
        const centerY = bounds.top + bounds.height / 2;
        lettering.context.fillText(plan.text, bounds.left + bounds.width / 2,
            centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
        if (!textFitsMask(lettering.context.getImageData(0, 0, source.width, source.height).data, maskPixels.data)) {
            throw new Error('Paint a filled area large enough for the complete text. Your original image is unchanged.');
        }
        base.context.drawImage(lettering.canvas, 0, 0);
        const replacement = base.context.getImageData(0, 0, source.width, source.height);
        replacement.data.set(applyMaskedPixels(original.data, replacement.data, maskPixels.data));
        base.context.putImageData(replacement, 0, 0);
        return { mimeType: 'image/png', data: base.canvas.toDataURL('image/png').split(',')[1]! };
    } finally { source.close(); selection?.close(); }
}
