import { describe, expect, it } from 'vitest';
import { safeStorageFetch } from './safeStorageFetch';

// Pure byte-decoding checks, not proof of authenticated artwork persistence.
describe('inline artwork asset decoding', () => {
    it('preserves uploaded binary bytes and MIME type without a network fetch', async () => {
        const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0, 128, 255, 10]);
        const source = `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`;
        const { blob, mimeType } = await safeStorageFetch(source);
        const decoded = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
        expect(new Uint8Array(decoded)).toEqual(bytes);
        expect(blob.size).toBe(bytes.length);
        expect(mimeType).toBe('image/jpeg');
    });

    it('rejects malformed base64 rather than persisting damaged image bytes', async () => {
        await expect(safeStorageFetch('data:image/png;base64,%%%')).rejects.toThrow();
    });
});
