import { describe, expect, it } from 'vitest';
import { imageDataUrlToBlob } from './imageDataUrl';

// Pure byte conversion: no browser authentication, upload, or network response is simulated.
describe('canvas image decoding', () => {
    it('preserves PNG bytes and content type without a network request', async () => {
        const blob = imageDataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
        expect(blob.type).toBe('image/png');
        expect(blob.size).toBe(8);
        const bytes = await new Promise<Uint8Array>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
        expect([...bytes]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    });

    it.each(['', 'https://example.com/image.png', 'data:text/plain;base64,SGk=', 'data:image/png;base64,%%%'])('rejects invalid image data: %s', input => {
        expect(() => imageDataUrlToBlob(input)).toThrow('Canvas export did not contain a valid image.');
    });
});
