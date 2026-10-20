import { auth } from '@/services/firebase';
import { StorageService } from '@/services/StorageService';
import type { CutoutInput } from './segmentation/GrabCut';

class CutoutWorkerUnavailable extends Error {}

/** Keep the original photo available for recovery after transferring its pixels to the worker. */
export async function generateArtworkMask(input: CutoutInput, signal: AbortSignal, onProgress: (value: number) => void, rereadPixels: () => Uint8ClampedArray): Promise<Uint8Array> {
    try {
        return await new Promise<Uint8Array>((resolve, reject) => {
            if (signal.aborted) { reject(new DOMException('Cutout cancelled', 'AbortError')); return; }
            let worker: Worker;
            try { worker = new Worker(new URL('./segmentation/CutoutWorker.ts', import.meta.url), { type: 'module' }); }
            catch (failure) { reject(new CutoutWorkerUnavailable('Cutout worker could not start', { cause: failure })); return; }
            const finish = () => { worker.terminate(); clearTimeout(timer); signal.removeEventListener('abort', cancel); };
            const cancel = () => { finish(); reject(new DOMException('Cutout cancelled', 'AbortError')); };
            const timer = setTimeout(() => { finish(); reject(new Error('Cutout took too long. Use a tighter box around the artist and retry.')); }, 60_000);
            signal.addEventListener('abort', cancel, { once: true });
            worker.onerror = event => { finish(); reject(new CutoutWorkerUnavailable(event.message || 'Cutout worker could not process this photo')); };
            worker.onmessage = (event: MessageEvent<{ kind: 'progress' | 'result' | 'error'; progress: number; mask: Uint8Array; message: string }>) => {
                if (event.data.kind === 'progress') onProgress(event.data.progress);
                else { finish(); if (event.data.kind === 'result') resolve(event.data.mask); else reject(new Error(event.data.message)); }
            };
            try { worker.postMessage(input, [input.pixels.buffer as ArrayBuffer]); }
            catch (failure) { finish(); reject(new CutoutWorkerUnavailable('Cutout worker could not receive the photo', { cause: failure })); }
        });
    } catch (failure) {
        if (!(failure instanceof CutoutWorkerUnavailable)) throw failure;
        signal.throwIfAborted();
        // Let React show progress before the synchronous, full-resolution recovery pass.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        signal.throwIfAborted();
        const { extractCutout } = await import('./segmentation/GrabCut');
        const mask = extractCutout({ ...input, pixels: rereadPixels() }, onProgress);
        signal.throwIfAborted();
        return mask;
    }
}

export async function persistArtworkMask(mask: Uint8Array, width: number, height: number, documentId: string): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in to save the artist cutout');
    if (mask.length !== width * height || width * height > 24_000_000) throw new Error('Cutout mask dimensions are invalid');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cutout mask rendering unavailable');
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < mask.length; i++) { image.data[i * 4] = mask[i]!; image.data[i * 4 + 1] = mask[i]!; image.data[i * 4 + 2] = mask[i]!; image.data[i * 4 + 3] = 255; }
    ctx.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Cutout mask could not be encoded')), 'image/png'));
    canvas.width = 0; canvas.height = 0;
    if (auth.currentUser?.uid !== uid) throw new Error('Sign in again before saving this cutout');
    return StorageService.uploadFile(blob, `users/${uid}/artwork/${documentId}/masks/${crypto.randomUUID()}.png`);
}
