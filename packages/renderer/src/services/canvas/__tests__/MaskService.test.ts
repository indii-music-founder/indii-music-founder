import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateArtworkMask } from '../MaskService';

vi.mock('@/services/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/services/StorageService', () => ({ StorageService: {} }));

afterEach(() => vi.unstubAllGlobals());

// Structural worker transport only; real persistence and UI acceptance use the genuine-account walkthrough.
describe('cutout worker recovery', () => {
    it.each([false, true])('recovers full-resolution pixels after worker failure (saved mask: %s)', async (refinement) => {
        class FailingWorker {
            onerror: ((event: ErrorEvent) => void) | null = null;
            onmessage: ((event: MessageEvent) => void) | null = null;
            postMessage(input: { pixels: Uint8ClampedArray }) {
                structuredClone(input.pixels.buffer, { transfer: [input.pixels.buffer] });
                queueMicrotask(() => this.onerror?.(new ErrorEvent('error', { message: 'Worker failed to load' })));
            }
            terminate() { /* The service must clean up the failed worker. */ }
        }
        vi.stubGlobal('Worker', FailingWorker);
        const width = 48, height = 48;
        const photo = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            photo.set(x >= 14 && x < 34 && y >= 10 && y < 38 ? [220, 35, 35, 255] : [30, 45, 210, 255], (y * width + x) * 4);
        }
        const baseMask = new Uint8Array(width * height);
        for (let i = 0; i < baseMask.length; i++) baseMask[i] = photo[i * 4] === 220 ? 255 : 0;
        baseMask[5 * width + 5] = 128;
        const originalMask = baseMask.slice();
        const reread = vi.fn(() => photo.slice());
        const progress = vi.fn();
        const input = { width, height, pixels: photo.slice(), rectangle: { x: 8, y: 6, width: 32, height: 36 }, strokes: [], baseMask: refinement ? baseMask : undefined };
        const mask = await generateArtworkMask(input, new AbortController().signal, progress, reread);
        expect(input.pixels.byteLength).toBe(0);
        expect(reread).toHaveBeenCalledOnce();
        expect(mask).toHaveLength(width * height);
        expect(mask[20 * width + 28]).toBe(255);
        expect(mask[3 * width + 3]).toBe(0);
        expect(progress).toHaveBeenCalledWith(1);
        if (refinement) expect(mask[5 * width + 5]).toBe(128);
        expect(baseMask).toEqual(originalMask);
    });
});
