import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostMasteringMutation } from '../usePostMasteringMutation';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

const mockInvalidateAudioProfile = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => selector({
        invalidateAudioProfile: mockInvalidateAudioProfile,
    })),
}));

vi.mock('@/services/metadata/TrackLibraryService', () => ({
    trackLibrary: {
        getByFingerprint: vi.fn(),
        saveTrack: vi.fn(),
    },
}));

describe('usePostMasteringMutation hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mutates master metadata and invalidates the audio intelligence cache', async () => {
        const existingTrack = {
            id: 'fp-1',
            masterFingerprint: 'fp-1',
            trackTitle: 'Original Mix',
            genre: 'Rock',
        } as ExtendedGoldenMetadata;

        vi.mocked(trackLibrary.getByFingerprint).mockResolvedValue(existingTrack);
        vi.mocked(trackLibrary.saveTrack).mockResolvedValue(undefined);

        const { result } = renderHook(() => usePostMasteringMutation());

        let mutationResult: ExtendedGoldenMetadata | undefined;
        await act(async () => {
            mutationResult = await result.current.mutateMasterData('fp-1', {
                trackTitle: 'Mastered Final Mix',
                isGolden: true,
            });
        });

        expect(trackLibrary.getByFingerprint).toHaveBeenCalledWith('fp-1');
        expect(trackLibrary.saveTrack).toHaveBeenCalledWith(expect.objectContaining({
            masterFingerprint: 'fp-1',
            trackTitle: 'Mastered Final Mix',
            isGolden: true,
        }));
        expect(mockInvalidateAudioProfile).toHaveBeenCalledWith('fp-1');
        expect(mutationResult?.trackTitle).toBe('Mastered Final Mix');
        expect(result.current.lastMutatedFingerprint).toBe('fp-1');
        expect(result.current.isMutating).toBe(false);
    });

    it('invokes optimistic update and rollback handlers on failure', async () => {
        const existingTrack = {
            id: 'fp-2',
            masterFingerprint: 'fp-2',
            trackTitle: 'Before Error',
        } as ExtendedGoldenMetadata;

        vi.mocked(trackLibrary.getByFingerprint).mockResolvedValue(existingTrack);
        vi.mocked(trackLibrary.saveTrack).mockRejectedValue(new Error('Network failure'));

        const onOptimisticUpdate = vi.fn();
        const onRollback = vi.fn();

        const { result } = renderHook(() => usePostMasteringMutation());

        await act(async () => {
            await expect(result.current.mutateMasterData('fp-2', { trackTitle: 'Failed' }, {
                onOptimisticUpdate,
                onRollback,
            })).rejects.toThrow('Network failure');
        });

        expect(onOptimisticUpdate).toHaveBeenCalledWith(expect.objectContaining({ trackTitle: 'Failed' }));
        expect(onRollback).toHaveBeenCalledWith(existingTrack);
        expect(result.current.error?.message).toBe('Network failure');
        expect(result.current.isMutating).toBe(false);
    });
});
