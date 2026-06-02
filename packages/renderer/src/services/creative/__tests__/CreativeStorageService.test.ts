import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreativeStorageService } from '../CreativeStorageService';
import { uploadBytes, uploadString } from 'firebase/storage';

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
});
