import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
    getDownloadURL: vi.fn(),
    getMetadata: vi.fn(),
    ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
    uploadBytes: vi.fn(),
}));

vi.mock('firebase/storage', () => storageMocks);
vi.mock('@/services/firebase', () => ({ storage: { bucket: 'test-bucket' } }));

import { canonicalCoverArtService } from './CanonicalCoverArtService';

describe('CanonicalCoverArtService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storageMocks.getMetadata.mockRejectedValue({ code: 'storage/object-not-found' });
        storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.googleapis.com/v0/b/test/o/covers%2Fowner-1%2Fhash?alt=media');
        storageMocks.uploadBytes.mockResolvedValue({});
    });

    it('content-addresses selected bytes into an immutable owner-scoped cover reference', async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
            new Response(new Blob([bytes]), { headers: { 'content-type': 'image/png' } }),
        )));

        const result = await canonicalCoverArtService.persistFromUrl('https://assets.example.test/cover.png', {
            userId: 'owner-1',
            originalFileName: 'release-cover.png',
        });

        expect(result.storage_path).toBe(`covers/owner-1/${result.content_hash}/original.png`);
        expect(result.mime_type).toBe('image/png');
        expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
            expect.objectContaining({ fullPath: result.storage_path }),
            expect.any(Uint8Array),
            expect.objectContaining({
                contentType: 'image/png',
                customMetadata: expect.objectContaining({
                    contentHash: result.content_hash,
                    immutable: 'true',
                    ownerId: 'owner-1',
                }),
            }),
        );
    });

    it('reuses only an existing object carrying matching immutable ownership metadata', async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
            new Response(new Blob([bytes]), { headers: { 'content-type': 'image/png' } }),
        )));
        const first = await canonicalCoverArtService.persistFromUrl('https://assets.example.test/cover.png', { userId: 'owner-1' });
        storageMocks.getMetadata.mockResolvedValue({
            customMetadata: { contentHash: first.content_hash, immutable: 'true', ownerId: 'owner-1' },
        });
        storageMocks.uploadBytes.mockClear();

        await canonicalCoverArtService.persistFromUrl('https://assets.example.test/cover.png', { userId: 'owner-1' });

        expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
    });

    it('content-addresses a directly selected file without first creating a packaging copy', async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        const file = new File([bytes], 'cover.png', { type: 'image/png' });
        Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
        const result = await canonicalCoverArtService.persistFile(file, { userId: 'owner-1' });

        expect(result.storage_path).toMatch(/^covers\/owner-1\/[a-f0-9]{64}\/original\.png$/);
        expect(storageMocks.uploadBytes).toHaveBeenCalledOnce();
    });

    it('fails closed for unsupported or unreadable artwork', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob([new Uint8Array([1])]), { headers: { 'content-type': 'image/webp' } })));
        await expect(canonicalCoverArtService.persistFromUrl('https://assets.example.test/cover.webp', { userId: 'owner-1' }))
            .rejects.toThrow('JPEG or PNG');
        expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
    });
});
