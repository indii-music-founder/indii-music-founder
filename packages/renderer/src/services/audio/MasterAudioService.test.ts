import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
    getDownloadURL: vi.fn(),
    getMetadata: vi.fn(),
    ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
    uploadBytes: vi.fn(),
}));

const profilingMocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('firebase/storage', () => storageMocks);
vi.mock('firebase/functions', () => profilingMocks);

vi.mock('@/services/firebase', () => ({
    storage: { bucket: 'test-bucket' },
    functions: { project: 'test-project' },
}));

import { masterAudioService } from './MasterAudioService';

describe('MasterAudioService', () => {
    function pcmWav({ rate = 48_000, bits = 24, channels = 2 } = {}): Uint8Array {
        const bytes = new Uint8Array(44);
        const view = new DataView(bytes.buffer);
        bytes.set(new TextEncoder().encode('RIFF'), 0);
        view.setUint32(4, 36, true);
        bytes.set(new TextEncoder().encode('WAVEfmt '), 8);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, rate, true);
        view.setUint16(34, bits, true);
        bytes.set(new TextEncoder().encode('data'), 36);
        return bytes;
    }

    function blobPart(bytes: Uint8Array): ArrayBuffer {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }

    const file = new File([blobPart(pcmWav())], 'Final Master.WAV', { type: 'audio/wav' });

    beforeEach(() => {
        vi.clearAllMocks();
        storageMocks.getDownloadURL.mockResolvedValue('https://storage.example/master.wav');
        profilingMocks.httpsCallable.mockReturnValue(profilingMocks.callable);
        profilingMocks.callable.mockImplementation(async (request: { storagePath: string; masterFingerprint: string }) => ({
            data: {
                success: true,
                status: 'QUEUED_FOR_DSP_PROFILING',
                masterFingerprint: request.masterFingerprint,
                contentHash: request.storagePath.split('/')[2],
                generation: '987654321',
            },
        }));
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
        expect(result.generation).toBe('987654321');
        expect(result.mimeType).toBe('audio/wav');
        expect(result.sizeBytes).toBe(file.size);
        expect(result.audioProperties).toEqual({
            bitDepth: 24,
            channels: 2,
            codec: 'PCM',
            container: 'wav',
            sampleRate: 48_000,
        });
        expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
            expect.objectContaining({ fullPath: result.storagePath }),
            file,
            {
                contentType: 'audio/wav',
                customMetadata: {
                    bitDepth: '24',
                    channels: '2',
                    codec: 'PCM',
                    container: 'wav',
                    contentHash: result.contentHash,
                    immutable: 'true',
                    masterFingerprint: 'SONIC-abc',
                    ownerId: 'owner-1',
                    originalFileName: 'Final Master.WAV',
                    sampleRate: '48000',
                },
            }
        );
        expect(profilingMocks.httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'processAudioIngestion'
        );
        expect(profilingMocks.callable).toHaveBeenCalledWith({
            storagePath: result.storagePath,
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

    it('rejects renamed or lossy bytes before creating a canonical master object', async () => {
        const renamedMp3 = new File([
            blobPart(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])),
        ], 'Fake Master.wav', { type: 'audio/wav' });

        await expect(masterAudioService.persist(renamedMp3, {
            userId: 'owner-1',
            masterFingerprint: 'SONIC-lossy',
        })).rejects.toThrow(/WAV or FLAC master|truncated/);

        expect(storageMocks.getMetadata).not.toHaveBeenCalled();
        expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
    });

    it('does not report ingestion success when the protected profiling route rejects the master', async () => {
        storageMocks.getMetadata.mockResolvedValue({
            customMetadata: { masterFingerprint: 'SONIC-abc' },
            timeCreated: '2026-07-17T18:00:00.000Z',
        });
        profilingMocks.callable.mockRejectedValue(new Error('DSP route unavailable'));

        await expect(masterAudioService.persist(file, {
            userId: 'owner-1',
            masterFingerprint: 'SONIC-abc',
        })).rejects.toThrow(/DSP route unavailable/);

        expect(storageMocks.getDownloadURL).not.toHaveBeenCalled();
    });
});
