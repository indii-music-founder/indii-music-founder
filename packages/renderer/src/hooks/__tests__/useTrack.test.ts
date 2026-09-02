import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrack } from '../useTrack';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => selector({ user: { uid: 'user-1' } })),
}));

vi.mock('@/services/metadata/TrackLibraryService', () => ({
    trackLibrary: {
        subscribeTrack: vi.fn(),
        saveTrack: vi.fn(),
    },
}));

describe('useTrack hook', () => {
    let mockOnUpdate: (track: any) => void;
    let mockOnError: (err: any) => void;
    const unsubscribeMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(trackLibrary.subscribeTrack).mockImplementation((_fp, onUpdate, onError) => {
            mockOnUpdate = onUpdate;
            if (onError) mockOnError = onError;
            return unsubscribeMock;
        });
    });

    it('subscribes to single track via onSnapshot and returns track data', () => {
        const { result } = renderHook(() => useTrack('SONIC-1'));

        expect(trackLibrary.subscribeTrack).toHaveBeenCalledWith('SONIC-1', expect.any(Function), expect.any(Function));
        expect(result.current.loading).toBe(true);

        act(() => {
            mockOnUpdate({
                id: 'SONIC-1',
                trackTitle: 'Echoes of Detroit',
                genre: 'Techno',
                _hasPendingWrites: false,
                _isFromCache: false,
            });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.track?.trackTitle).toBe('Echoes of Detroit');
        expect(result.current.hasPendingSync).toBe(false);
    });

    it('handles null fingerprint without subscribing', () => {
        const { result } = renderHook(() => useTrack(null));
        expect(trackLibrary.subscribeTrack).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
        expect(result.current.track).toBeNull();
    });

    it('handles snapshot error gracefully', () => {
        const { result } = renderHook(() => useTrack('SONIC-1'));

        const testError = new Error('Permission denied');
        act(() => {
            mockOnError(testError);
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(testError);
    });

    it('cleans up subscription on unmount', () => {
        const { unmount } = renderHook(() => useTrack('SONIC-1'));
        unmount();
        expect(unsubscribeMock).toHaveBeenCalled();
    });
});
