import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/services/firebase';
import { CloudStorageService } from '@/services/CloudStorageService';
import { AudioPersistenceService, PersistedAudioMetadata } from './AudioPersistenceService';

const { mockDeleteAudio } = vi.hoisted(() => ({ mockDeleteAudio: vi.fn() }));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: { deleteAudio: mockDeleteAudio },
}));

const asset: PersistedAudioMetadata = {
    id: 'audio-1',
    userId: 'attacker',
    type: 'music',
    prompt: 'A focused synth cue',
    mimeType: 'audio/wav',
    estimatedDuration: 12,
    generatedAt: '2026-07-11T10:00:00.000Z',
    storageUrl: 'https://storage.example/audio-1.wav',
};

describe('AudioPersistenceService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockDeleteAudio.mockReset();
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
    });

    it('retains metadata when storage cleanup fails so deletion can be retried', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'get').mockResolvedValue({ ...asset, userId: 'owner-1' });
        const deleteMetadata = vi.spyOn(service, 'delete').mockResolvedValue(undefined);
        vi.mocked(CloudStorageService.deleteAudio).mockRejectedValue(new Error('storage unavailable'));

        await expect(service.deleteAudio('audio-1')).rejects.toThrow('storage unavailable');
        expect(deleteMetadata).not.toHaveBeenCalled();
    });

    it('rejects deletion of metadata owned by another user', async () => {
        const service = new AudioPersistenceService();
        vi.spyOn(service, 'get').mockResolvedValue(asset);
        const deleteMetadata = vi.spyOn(service, 'delete').mockResolvedValue(undefined);

        await expect(service.deleteAudio('audio-1')).rejects.toThrow('does not belong');
        expect(deleteMetadata).not.toHaveBeenCalled();
    });
});
