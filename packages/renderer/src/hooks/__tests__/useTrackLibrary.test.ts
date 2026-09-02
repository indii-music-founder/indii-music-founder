import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrackLibrary } from '../useTrackLibrary';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => selector({ user: { uid: 'user-1' } })),
}));

vi.mock('@/services/metadata/TrackLibraryService', () => ({
    trackLibrary: {
        subscribeTracks: vi.fn(),
        saveTrack: vi.fn(),
        deleteTrack: vi.fn(),
    },
}));

describe('useTrackLibrary hook', () => {
    let mockOnUpdate: (tracks: any[]) => void;
    let mockOnError: (err: any) => void;
    const unsubscribeMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(trackLibrary.subscribeTracks).mockImplementation((onUpdate, onError) => {
            mockOnUpdate = onUpdate;
            if (onError) mockOnError = onError;
            return unsubscribeMock;
        });
    });

    it('subscribes to trackLibrary with onSnapshot and returns tracks', () => {
        const { result } = renderHook(() => useTrackLibrary());

        expect(trackLibrary.subscribeTracks).toHaveBeenCalled();
        expect(result.current.loading).toBe(true);

        const sampleTracks = [
            { id: '1', trackTitle: 'Neon Waves', genre: 'Synthwave', isGolden: true },
            { id: '2', trackTitle: 'Midnight Drive', genre: 'Retrowave', isGolden: false },
        ] as ExtendedGoldenMetadata[];

        act(() => {
            mockOnUpdate(sampleTracks);
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.tracks).toHaveLength(2);
        expect(result.current.tracks[0]?.trackTitle).toBe('Neon Waves');
    });

    it('filters tracks by searchQuery', () => {
        const { result } = renderHook(() => useTrackLibrary({ searchQuery: 'Midnight' }));

        const sampleTracks = [
            { id: '1', trackTitle: 'Neon Waves', genre: 'Synthwave' },
            { id: '2', trackTitle: 'Midnight Drive', genre: 'Retrowave' },
        ] as ExtendedGoldenMetadata[];

        act(() => {
            mockOnUpdate(sampleTracks);
        });

        expect(result.current.tracks).toHaveLength(1);
        expect(result.current.tracks[0]?.trackTitle).toBe('Midnight Drive');
    });

    it('filters tracks by genre and golden status', () => {
        const { result } = renderHook(() => useTrackLibrary({ genreFilter: 'Synthwave', goldenOnly: true }));

        const sampleTracks = [
            { id: '1', trackTitle: 'Neon Waves', genre: 'Synthwave', isGolden: true },
            { id: '2', trackTitle: 'Retro Run', genre: 'Synthwave', isGolden: false },
            { id: '3', trackTitle: 'Midnight Drive', genre: 'Retrowave', isGolden: true },
        ] as ExtendedGoldenMetadata[];

        act(() => {
            mockOnUpdate(sampleTracks);
        });

        expect(result.current.tracks).toHaveLength(1);
        expect(result.current.tracks[0]?.trackTitle).toBe('Neon Waves');
    });

    it('handles snapshot error gracefully', () => {
        const { result } = renderHook(() => useTrackLibrary());

        const testError = new Error('Permission denied');
        act(() => {
            mockOnError(testError);
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(testError);
    });

    it('cleans up subscription on unmount', () => {
        const { unmount } = renderHook(() => useTrackLibrary());
        unmount();
        expect(unsubscribeMock).toHaveBeenCalled();
    });
});
