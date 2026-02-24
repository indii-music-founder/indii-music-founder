import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReleases } from './useReleases';
import { onSnapshot } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
  serverTimestamp: vi.fn(),
    db: {}
}));

describe('useReleases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subscribes to Firestore on mount', () => {
        const mockUnsubscribe = vi.fn();
        vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);

        const { unmount } = renderHook(() => useReleases('test-org-id'));

        expect(onSnapshot).toHaveBeenCalled();

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('updates releases when data is received', async () => {
        let snapshotCallback: (snapshot: any) => void;
        vi.mocked(onSnapshot).mockImplementation(((q: any, arg2: any, arg3: any) => {
            // Handle both signatures: (q, onNext) and (q, options, onNext)
            if (typeof arg2 === 'function') {
                snapshotCallback = arg2;
            } else {
                snapshotCallback = arg3;
            }
            return vi.fn();
        }) as any);

        const { result } = renderHook(() => useReleases('test-org-id'));

        expect(result.current.loading).toBe(true);

        const mockSnapshot = {
            metadata: { hasPendingWrites: false, fromCache: false },
            docs: [
                {
                    id: 'doc-1',
                    data: () => ({
  serverTimestamp: vi.fn(), metadata: { trackTitle: 'Song 1' } }),
                    metadata: { hasPendingWrites: false, fromCache: false }
                }
            ]
        };

        // Ensure callback is assigned
        if (snapshotCallback!) {
            act(() => {
                snapshotCallback(mockSnapshot);
            });
        }

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.releases).toHaveLength(1);
        expect(result.current.releases[0].metadata.trackTitle).toBe('Song 1');
    });

    it('handles errors from Firestore', async () => {
        let errorCallback: (err: any) => void;
        vi.mocked(onSnapshot).mockImplementation(((q: any, arg2: any, arg3: any, arg4: any) => {
            // Handle both signatures: (q, onNext, onError) and (q, options, onNext, onError)
            if (typeof arg2 === 'function') {
                errorCallback = arg3;
            } else {
                errorCallback = arg4;
            }
            return vi.fn();
        }) as any);

        const { result } = renderHook(() => useReleases('test-org-id'));

        const mockError = new Error('Firestore Error');
        if (errorCallback!) {
            act(() => {
                errorCallback(mockError);
            });
        }

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe(mockError);
        expect(result.current.releases).toHaveLength(0);
    });

    it('does not subscribe if orgId is missing', () => {
        renderHook(() => useReleases(''));
        expect(onSnapshot).not.toHaveBeenCalled();
    });
});
