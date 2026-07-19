import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({
    storage: {
        app: {
            options: {
                storageBucket: 'mock-bucket.appspot.com',
            },
        },
    },
}));

describe('storageUri helpers', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('builds canonical gs:// asset paths', async () => {
        const { buildAssetStorageUri } = await import('./storageUri');
        expect(buildAssetStorageUri('asset-1', 'user-1')).toBe('gs://mock-bucket.appspot.com/users/user-1/assets/asset-1');
    });

    it('resolves Firebase download URLs back to gs:// URIs', async () => {
        const { resolveStorageUri } = await import('./storageUri');
        expect(resolveStorageUri('https://firebasestorage.googleapis.com/v0/b/mock-bucket.appspot.com/o/users%2Fuser-1%2Fassets%2Fasset-1.mp4?alt=media&token=abc')).toBe(
            'gs://mock-bucket.appspot.com/users/user-1/assets/asset-1.mp4'
        );
    });

    it('resolves storage.googleapis.com URLs back to gs:// URIs', async () => {
        const { resolveStorageUri } = await import('./storageUri');
        expect(resolveStorageUri('https://storage.googleapis.com/mock-bucket.appspot.com/users/user-1/assets/asset-1.mp4?download=1')).toBe(
            'gs://mock-bucket.appspot.com/users/user-1/assets/asset-1.mp4'
        );
    });
});
