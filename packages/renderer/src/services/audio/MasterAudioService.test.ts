import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
    getDownloadURL: vi.fn(),
    getMetadata: vi.fn(),
    ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
    uploadBytes: vi.fn(),
}));

const verificationMocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('firebase/storage', () => storageMocks);
vi.mock('firebase/functions', () => verificationMocks);

vi.mock('@/services/firebase', () => ({
    storage: { bucket: 'test-bucket' },
    functions: { project: 'test-project' },
}));

import { masterAudioService } from './MasterAudioService';

describe('MasterAudioService', () => {
    const file = new File(['canonical master bytes'], 'Final Master.WAV', { type: 'audio/wav' });

    beforeEach(() => {
        vi.clearAllMocks();
        storageMocks.getDownloadURL.mockResolvedValue('https://storage.example/master.wav');
        verificationMocks.httpsCallable.mockReturnValue(verificationMocks.callable);
        verificationMocks.callable.mockResolvedValue({ data: { verified: true } });
    });

    it('creates one content-addressed, immutable master object with durable identity metadata', async () => {
        storageMocks.getMetadata
            .mockRejectedValueOnce({ code: 'storage/object-not-found' })
            .mockResolvedValueOnce({ timeCreated: '2026-07-17T18:00:00.000Z' });
        storageMocks.uploadBytes.mockResolvedValue({});

        const result = await masterAudioService.persist(file, {
            userId: 'owner-1',
            masterFingerprint: 'SONIC-abc',
        });

        expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
        expect(result.storagePath).toBe(
            `masters/owner-1/${result.contentHash}/original.wav`
        );
        expect(result.downloadUrl).toBe('https://storage.example/master.wav');
        expect(result.masterFingerprint).toBe('SONIC-abc');
        expect(result.mimeType).toBe('audio/wav');
        expect(result.sizeBytes).toBe(file.size);
        expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
            expect.objectContaining({ fullPath: result.storagePath }),
            file,
            {
                contentType: 'audio/wav',
                customMetadata: {
                    contentHash: result.contentHash,
                    immutable: 'true',
                    masterFingerprint: 'SONIC-abc',
                    ownerId: 'owner-1',
                    originalFileName: 'Final Master.WAV',
                },
            }
        );
        expect(verificationMocks.httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'verifyMasterAudio'
        );
        expect(verificationMocks.callable).toHaveBeenCalledWith({
            storagePath: result.storagePath,
            expectedSha256: result.contentHash,
            masterFingerprint: 'SONIC-abc',
        });
    });

    it('reuses an existing object for identical bytes without overwriting it', async () => {
        storageMocks.getMetadata.mockResolvedValue({
            customMetadata: {
                contentHash: 'existing',
                immutable: 'true',
                masterFingerprint: 'SONIC-abc',
                ownerId: 'owner-1',
                originalFileName: 'Final Master.WAV',
            },
            timeCreated: '2026-07-17T18:00:00.000Z',
        });

        const result = await masterAudioService.persist(file, {
            userId: 'owner-1',
            masterFingerprint: 'SONIC-abc',
        });

        expect(result.storagePath).toContain(`masters/owner-1/${result.contentHash}/`);
        expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
    });
});
