import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeReleaseRecord, useReleases } from './useReleases';
import { onSnapshot, where } from 'firebase/firestore';
import type { ReleaseWorkspace } from '@/services/distribution/releaseWorkspace';

const ORG_WORKSPACE: ReleaseWorkspace = { kind: 'organization', orgId: 'test-org-id', userId: 'test-user' };
const PERSONAL_WORKSPACE: ReleaseWorkspace = { kind: 'personal', orgId: 'personal', userId: 'test-user' };

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
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('useReleases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subscribes to Firestore on mount', () => {
        const mockUnsubscribe = vi.fn();
        vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);

        const { unmount } = renderHook(() => useReleases(ORG_WORKSPACE));

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

        const { result } = renderHook(() => useReleases(ORG_WORKSPACE));

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
        expect(result.current.releases[0]!.metadata.trackTitle).toBe('Song 1');
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

        const { result } = renderHook(() => useReleases(ORG_WORKSPACE));

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

    it('does not subscribe without a proven workspace', () => {
        renderHook(() => useReleases(null));
        expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('reads a personal workspace by userId and an organization by orgId (ISSUE-1695)', () => {
        vi.mocked(onSnapshot).mockReturnValue(vi.fn());

        renderHook(() => useReleases(PERSONAL_WORKSPACE));
        expect(where).toHaveBeenLastCalledWith('userId', '==', 'test-user');

        renderHook(() => useReleases(ORG_WORKSPACE));
        expect(where).toHaveBeenLastCalledWith('orgId', '==', 'test-org-id');
        expect(where).not.toHaveBeenCalledWith('orgId', '==', 'personal');
    });
});

describe('normalizeReleaseRecord', () => {
    it('gives older records without metadata/assets the shapes Publishing reads', () => {
        expect(normalizeReleaseRecord('r1', { userId: 'u', title: 'Legacy Title', artist: 'Legacy Artist', status: 'STAGED' })).toEqual({
            id: 'r1',
            userId: 'u',
            title: 'Legacy Title',
            artist: 'Legacy Artist',
            status: 'STAGED',
            metadata: { trackTitle: 'Legacy Title', artistName: 'Legacy Artist' },
            assets: {},
            distributors: [],
        });
        expect(normalizeReleaseRecord('r2', { metadata: 'bad', distributors: 'bad' })).toMatchObject({ metadata: {}, assets: {}, distributors: [] });
    });

    it('keeps well-formed records unchanged', () => {
        const data = { metadata: { trackTitle: 'Song' }, assets: { coverArtUrl: 'x' }, distributors: [{ distributorId: 'd', status: 'pending' }] };
        expect(normalizeReleaseRecord('r3', data)).toEqual({ id: 'r3', ...data });
    });
});
