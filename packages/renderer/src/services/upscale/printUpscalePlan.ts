/** Select real enhancement only when the source lacks pixels for the trim crop. */
export function planPrintUpscale(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
    for (const value of [sourceWidth, sourceHeight, targetWidth, targetHeight]) {
        if (!Number.isInteger(value) || value < 1) throw new Error('Print dimensions must be positive whole pixels.');
    }
    if (targetWidth * targetHeight > 80_000_000) throw new Error('This print exceeds the 80 megapixel limit. Choose a smaller target.');
    const factor = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    if (factor > 4) throw new Error('This print needs more than a 4× enlargement. Upload a larger original or choose a smaller print size.');
    const scale: 1 | 2 | 4 = factor <= 1 ? 1 : factor <= 2 ? 2 : 4;
    return { scale, width: sourceWidth * scale, height: sourceHeight * scale };
}

export type PrintUpscaleMethod = 'desktop-realesrgan' | 'browser-esrgan' | 'resize-only';

export function printUpscaleMethodLabel(method: PrintUpscaleMethod): string {
    return method === 'desktop-realesrgan' ? 'Desktop AI' : method === 'browser-esrgan' ? 'Browser AI' : 'Source pixels (no AI enlargement)';
}
