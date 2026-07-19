import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeStorageFetch } from './safeStorageFetch';

const mockFetchStorageAssetForCanvas = vi.fn();

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => mockFetchStorageAssetForCanvas),
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        warn: vi.fn(),
    },
}));

describe('safeStorageFetch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn()
            .mockRejectedValueOnce(new TypeError('CORS blocked'))
            .mockRejectedValueOnce(new TypeError('Opaque response unavailable'))
        );
    });

    it('uses the canvas Storage bridge when browser fetch cannot read Storage bytes', async () => {
        mockFetchStorageAssetForCanvas.mockResolvedValueOnce({
            data: {
                data: btoa('image-bytes'),
                mimeType: 'image/png',
                size: 11,
            },
        });

        const result = await safeStorageFetch('https://firebasestorage.googleapis.com/v0/b/indii-music-founder.firebasestorage.app/o/creative%2Fuser-1%2Fimage.png?alt=media');

        expect(mockFetchStorageAssetForCanvas).toHaveBeenCalledWith({
            uri: 'https://firebasestorage.googleapis.com/v0/b/indii-music-founder.firebasestorage.app/o/creative%2Fuser-1%2Fimage.png?alt=media',
        });
        expect(result.mimeType).toBe('image/png');
        
        const blobText = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(result.blob);
        });
        expect(blobText).toBe('image-bytes');
    });
});
