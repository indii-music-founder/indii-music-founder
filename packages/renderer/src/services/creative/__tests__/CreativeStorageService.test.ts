import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreativeStorageService } from '../CreativeStorageService';
import { ref as storageRef, uploadBytes, uploadString } from 'firebase/storage';

vi.mock('@/services/firebase', () => ({
    storage: {
        app: {
            options: {
                storageBucket: 'mock-bucket.appspot.com',
            },
        },
    },
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn((_storage, path: string) => ({ path })),
    uploadBytes: vi.fn().mockResolvedValue({}),
    uploadString: vi.fn().mockResolvedValue({}),
}));

describe('CreativeStorageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns existing gs:// reference media without re-uploading it', async () => {
        const uri = 'gs://mock-bucket.appspot.com/creative/user/reference.jpg';

        const result = await CreativeStorageService.uploadReferenceMedia('user', uri, 'image');

        expect(result).toBe(uri);
        expect(uploadBytes).not.toHaveBeenCalled();
        expect(uploadString).not.toHaveBeenCalled();
    });

    it('uploads scoped vault assets into owner-scoped folders', async () => {
        await CreativeStorageService.uploadReferenceMedia('user', 'data:image/png;base64,AAA', 'image', { scope: 'objects' });

        expect(storageRef).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('users/user/vault/objects/'));
        expect(uploadString).toHaveBeenCalled();
    });
});
