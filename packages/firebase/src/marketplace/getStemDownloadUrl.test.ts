/**
 * ISSUE-975: stem-pack storage paths must never be resolvable by anyone
 * except the product's seller or a buyer with a completed purchase. This
 * is the actual security boundary — these tests are the adversarial cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockManifestGet = vi.fn();
    const mockPurchaseQueryGet = vi.fn();
    const mockFileExists = vi.fn();
    const mockGetSignedUrl = vi.fn();

    const mockDb = {
        collection: vi.fn((name: string) => {
            if (name === 'marketplace_stem_manifests') {
                return { doc: vi.fn(() => ({ get: mockManifestGet })) };
            }
            if (name === 'purchases') {
                const chain = {
                    where: vi.fn(() => chain),
                    limit: vi.fn(() => chain),
                    get: mockPurchaseQueryGet,
                };
                return chain;
            }
            throw new Error(`Unexpected collection: ${name}`);
        }),
    };

    const mockBucket = {
        file: vi.fn(() => ({
            exists: mockFileExists,
            getSignedUrl: mockGetSignedUrl,
        })),
    };

    return { mockManifestGet, mockPurchaseQueryGet, mockFileExists, mockGetSignedUrl, mockDb, mockBucket };
});

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => mocks.mockDb,
}));

vi.mock('firebase-admin/storage', () => ({
    getStorage: () => ({ bucket: () => mocks.mockBucket }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts: unknown, handler: unknown) => handler,
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getStemDownloadUrl } from './getStemDownloadUrl';

function callable() {
    return getStemDownloadUrl as unknown as (request: {
        data: unknown;
        auth?: { uid: string };
    }) => Promise<{ url: string; expiresAt: number }>;
}

describe('getStemDownloadUrl', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects unauthenticated requests', async () => {
        await expect(callable()({ data: { productId: 'p1', label: 'drums' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'unauthenticated' }));
    });

    it('rejects a stranger who never purchased and is not the seller', async () => {
        mocks.mockManifestGet.mockResolvedValue({
            exists: true,
            data: () => ({ sellerId: 'seller-1', stemFiles: [{ label: 'drums', storagePath: 'stems/seller-1/d1/drums.wav' }] }),
        });
        mocks.mockPurchaseQueryGet.mockResolvedValue({ empty: true, docs: [] });

        await expect(callable()({ data: { productId: 'p1', label: 'drums' }, auth: { uid: 'stranger-1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'permission-denied' }));
        expect(mocks.mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('grants a signed URL to a buyer with a completed purchase', async () => {
        mocks.mockManifestGet.mockResolvedValue({
            exists: true,
            data: () => ({ sellerId: 'seller-1', stemFiles: [{ label: 'drums', storagePath: 'stems/seller-1/d1/drums.wav' }] }),
        });
        mocks.mockPurchaseQueryGet.mockResolvedValue({ empty: false, docs: [{}] });
        mocks.mockFileExists.mockResolvedValue([true]);
        mocks.mockGetSignedUrl.mockResolvedValue(['https://storage.googleapis.com/signed-url']);

        const result = await callable()({ data: { productId: 'p1', label: 'drums' }, auth: { uid: 'buyer-1' } });

        expect(result.url).toBe('https://storage.googleapis.com/signed-url');
        expect(mocks.mockGetSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: 'read' }));
    });

    it('grants a signed URL to the seller themself (no purchase needed)', async () => {
        mocks.mockManifestGet.mockResolvedValue({
            exists: true,
            data: () => ({ sellerId: 'seller-1', stemFiles: [{ label: 'bass', storagePath: 'stems/seller-1/d1/bass.wav' }] }),
        });
        mocks.mockFileExists.mockResolvedValue([true]);
        mocks.mockGetSignedUrl.mockResolvedValue(['https://storage.googleapis.com/seller-signed-url']);

        const result = await callable()({ data: { productId: 'p1', label: 'bass' }, auth: { uid: 'seller-1' } });

        expect(result.url).toBe('https://storage.googleapis.com/seller-signed-url');
        // Seller path must never even query purchases — ownership alone is sufficient.
        expect(mocks.mockPurchaseQueryGet).not.toHaveBeenCalled();
    });

    it('returns not-found for a product with no manifest', async () => {
        mocks.mockManifestGet.mockResolvedValue({ exists: false });

        await expect(callable()({ data: { productId: 'nonexistent', label: 'drums' }, auth: { uid: 'buyer-1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'not-found' }));
    });

    it('returns not-found for a label absent from the manifest', async () => {
        mocks.mockManifestGet.mockResolvedValue({
            exists: true,
            data: () => ({ sellerId: 'seller-1', stemFiles: [{ label: 'drums', storagePath: 'stems/seller-1/d1/drums.wav' }] }),
        });

        await expect(callable()({ data: { productId: 'p1', label: 'vocals' }, auth: { uid: 'seller-1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'not-found' }));
    });
});
