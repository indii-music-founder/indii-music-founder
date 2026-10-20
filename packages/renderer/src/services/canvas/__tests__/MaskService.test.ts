import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateArtworkMask } from '../MaskService';

vi.mock('@/services/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/services/StorageService', () => ({ StorageService: {} }));

afterEach(() => vi.unstubAllGlobals());

describe('cutout worker recovery', () => {
    it('rerenders the original photo and extracts a full-resolution mask after worker failure', async () => {
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
        const reread = vi.fn(() => photo.slice());
        const progress = vi.fn();
        const input = { width, height, pixels: photo.slice(), rectangle: { x: 8, y: 6, width: 32, height: 36 }, strokes: [] };
        const mask = await generateArtworkMask(input, new AbortController().signal, progress, reread);
        expect(input.pixels.byteLength).toBe(0);
        expect(reread).toHaveBeenCalledOnce();
        expect(mask).toHaveLength(width * height);
        expect(mask[20 * width + 28]).toBe(255);
        expect(mask[3 * width + 3]).toBe(0);
        expect(progress).toHaveBeenCalledWith(1);
    });
});
