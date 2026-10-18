import { adjustArtworkPixels, finishArtworkPixels, applyArtworkMask } from './ArtworkPixels';
import type { RasterLayer } from './CanvasDoc';

self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; maskBuffer?: ArrayBuffer; originalAlphaBuffer?: ArrayBuffer; width: number; height: number; layer: RasterLayer; phase: 'mask' | 'color' | 'finish' }>) => {
    try {
        const { buffer, maskBuffer, originalAlphaBuffer, width, height, layer, phase } = event.data;
        const pixels = new Uint8ClampedArray(buffer);
        if (phase === 'mask') {
            if (!maskBuffer) throw new Error('Cutout mask pixels are missing');
            applyArtworkMask(pixels, new Uint8ClampedArray(maskBuffer), originalAlphaBuffer ? new Uint8Array(originalAlphaBuffer) : undefined);
        } else if (phase === 'color') adjustArtworkPixels(pixels, layer);
        else finishArtworkPixels(pixels, width, height, layer);
        self.postMessage({ buffer }, { transfer: [buffer] });
    } catch (failure) {
        self.postMessage({ error: failure instanceof Error ? failure.message : 'Photo processing failed' });
    }
};
