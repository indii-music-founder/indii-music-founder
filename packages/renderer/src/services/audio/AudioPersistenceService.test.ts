import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/services/firebase';
import { CloudStorageService } from '@/services/CloudStorageService';
import { AudioPersistenceService, PersistedAudioMetadata } from './AudioPersistenceService';

const { mockDeleteStorageUri, mockResolveStorageUrl } = vi.hoisted(() => ({
    mockDeleteStorageUri: vi.fn(),
    mockResolveStorageUrl: vi.fn(),
}));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: { deleteStorageUri: mockDeleteStorageUri },
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: mockResolveStorageUrl,
}));

const asset: PersistedAudioMetadata = {
    id: 'audio-1',
    userId: 'attacker',
    type: 'music',
    prompt: 'A focused synth cue',
    mimeType: 'audio/wav',
    estimatedDuration: 12,
    generatedAt: '2026-07-11T10:00:00.000Z',
    storageUrl: 'gs://test-bucket/creative/owner-1/audio/outputs/audio-1.wav',
};

describe('AudioPersistenceService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockDeleteStorageUri.mockReset();
        mockResolveStorageUrl.mockReset();
        mockResolveStorageUrl.mockImplementation(async (uri: string) =>
            `https://storage.example/${uri.split('/').at(-1)}`
        );
        Object.defineProperty(auth, 'currentUser', {
            configurable: true,
            value: { uid: 'owner-1' },
        });
    });

    it('forces saved metadata ownership to the authenticated user', async () => {
        const service = new AudioPersistenceService();
        const setSpy = vi.spyOn(service, 'set').mockResolvedValue(undefined);

        await service.saveAudioMetadata(asset);

        expect(setSpy).toHaveBeenCalledWith('audio-1', expect.objectContaining({ userId: 'owner-1' }));
    });

    it('queries the canonical root collection and returns newest assets first', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'list').mockResolvedValue([
            { ...asset, id: 'old', userId: 'owner-1', generatedAt: '2026-01-01T00:00:00.000Z' },
            { ...asset, id: 'new', userId: 'owner-1', generatedAt: '2026-07-11T00:00:00.000Z' },
        ]);

        const result = await service.listUserAudio();

        expect(result.map(({ id }) => id)).toEqual(['new', 'old']);
        expect(result.every(item => item.playbackUrl?.startsWith('https://storage.example/'))).toBe(true);
    });

    it('retains metadata when storage cleanup fails so deletion can be retried', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'get').mockResolvedValue({ ...asset, userId: 'owner-1' });
        const deleteMetadata = vi.spyOn(service, 'delete').mockResolvedValue(undefined);
        vi.mocked(CloudStorageService.deleteStorageUri).mockRejectedValue(new Error('storage unavailable'));

        await expect(service.deleteAudio('audio-1')).rejects.toThrow('storage unavailable');
        expect(deleteMetadata).not.toHaveBeenCalled();
    });

    it('deletes the exact generated Storage object before removing its metadata', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'get').mockResolvedValue({ ...asset, userId: 'owner-1' });
        const deleteMetadata = vi.spyOn(service, 'delete').mockResolvedValue(undefined);
        vi.mocked(CloudStorageService.deleteStorageUri).mockResolvedValue(undefined);

        await service.deleteAudio('audio-1');

        expect(CloudStorageService.deleteStorageUri).toHaveBeenCalledWith(asset.storageUrl);
        expect(deleteMetadata).toHaveBeenCalledWith('audio-1');
    });

    it('rejects deletion of metadata owned by another user', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'get').mockResolvedValue(asset);
        const deleteMetadata = vi.spyOn(service, 'delete').mockResolvedValue(undefined);

        await expect(service.deleteAudio('audio-1')).rejects.toThrow('does not belong');
        expect(deleteMetadata).not.toHaveBeenCalled();
    });
});
