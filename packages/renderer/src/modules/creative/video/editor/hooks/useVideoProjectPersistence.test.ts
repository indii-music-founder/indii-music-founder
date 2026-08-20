import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVideoProjectPersistence } from './useVideoProjectPersistence';
import { useVideoEditorStore, blankProjectForId, INITIAL_PROJECT } from '@/modules/creative/video/store/videoEditorStore';
import { useStore } from '@/core/store';
import * as PersistenceService from '@/modules/creative/video/services/VideoProjectPersistenceService';
import type { WriteToken } from '@/modules/creative/video/services/VideoProjectPersistenceService';

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

// The global test setup (packages/renderer/src/test/setup.ts) replaces this
// store with a fully-stubbed mock for other test suites. This suite needs the
// REAL store (real subscribe/set behavior) to prove the persistence hook's
// load/reset/autosave wiring actually works — restore the actual module.
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

vi.mock('@/modules/creative/video/services/VideoProjectPersistenceService', () => ({
    loadVideoProject: vi.fn(),
    saveVideoProject: vi.fn(),
}));

// A token is opaque by design — tests fabricate one via the same cast the
// service uses internally.
const token = (projectId: string, revision: number | null = null): WriteToken =>
    ({ projectId, revision, fromLegacy: false }) as unknown as WriteToken;

describe('useVideoProjectPersistence', () => {
    const mockUser = { uid: 'test-user-123' };

    beforeEach(() => {
        vi.useFakeTimers();
        useVideoEditorStore.setState({
            project: INITIAL_PROJECT,
            isLoadingProject: false,
            projectLoadError: null,
            projectSaveError: null,
            isEphemeralSession: false,
        });
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            currentOrganizationId: 'org-1',
            organizations: [{ id: 'org-1' }],
            currentProjectId: 'project-a',
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('loads an existing per-project doc and applies it to the store (ISSUE-1147)', async () => {
        const existingProject = { ...blankProjectForId('project-a'), name: 'Saved Timeline' };
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'found',
            project: existingProject,
            token: token('project-a', 3),
        });

        renderHook(() => useVideoProjectPersistence());

        await vi.waitFor(() => {
            expect(useVideoEditorStore.getState().project.name).toBe('Saved Timeline');
        });
        expect(PersistenceService.loadVideoProject).toHaveBeenCalledWith('project-a', 'test-user-123');
    });

    it('starts a blank project scoped to the ID when no doc exists — isolation fix (ISSUE-1147)', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });

        renderHook(() => useVideoProjectPersistence());

        await vi.waitFor(() => {
            expect(useVideoEditorStore.getState().project.id).toBe('project-a');
        });
        expect(useVideoEditorStore.getState().project.clips).toEqual([]);
    });

    it('debounce-saves 5s after a project mutation, not on every keystroke', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });
        vi.mocked(PersistenceService.saveVideoProject).mockResolvedValue({
            success: true,
            token: token('project-a', 1),
        });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        useVideoEditorStore.getState().addTrack('audio');
        expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5000);
        expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(1);
    });

    it('does not resave an already-synced project on the interval tick', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });
        vi.mocked(PersistenceService.saveVideoProject).mockResolvedValue({
            success: true,
            token: token('project-a', 1),
        });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        await vi.advanceTimersByTimeAsync(30000);
        expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();
    });

    // Regression: ISSUE-1193 — a failed load used to be reported as `null`, the
    // same value as "no doc yet". The hook reset the store to a blank timeline
    // and the next edit autosaved that blank over the real document.
    // Found by /qa on 2026-07-22.
    // Report: .agent/test_ledger/OPEN_ISSUES_V2.md (ISSUE-1193)
    describe('load failure (ISSUE-1193)', () => {
        beforeEach(() => {
            vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
                status: 'error',
                error: new Error('permission-denied'),
            });
        });

        it('never issues a save after a failed load, even once the user edits', async () => {
            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().projectLoadError).toBeTruthy();
            });

            // The user edits anyway. Without a token there is nothing to save with.
            useVideoEditorStore.getState().addTrack('audio');
            await vi.advanceTimersByTimeAsync(60000); // past debounce AND interval

            expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();
        });

        it('leaves the loaded timeline untouched instead of blanking it', async () => {
            const realWork = {
                ...blankProjectForId('project-a'),
                clips: [{ id: 'real-clip', type: 'video' as const, startFrame: 0, durationInFrames: 90, trackId: 't', name: 'Real work' }],
            };
            useVideoEditorStore.setState({ project: realWork });

            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().projectLoadError).toBeTruthy();
            });

            // The store must NOT have been reset to a blank project.
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips[0]?.id).toBe('real-clip');
        });

        it('clears the loading spinner so the editor cannot hang', async () => {
            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().isLoadingProject).toBe(false);
            });
        });
    });

    // Regression: ISSUE-1194 — a guest could build a whole timeline and lose all of
    // it on reload, having never been told. Firestore's isAuthenticated() excludes
    // anonymous sign-ins, so every read and write is denied at the rules layer.
    // Found by /qa on 2026-07-22.
    // Report: .agent/test_ledger/OPEN_ISSUES_V2.md (ISSUE-1194)
    describe('guest session (ISSUE-1194)', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'anon-uid', isAnonymous: true },
                currentOrganizationId: 'org-1',
                organizations: [{ id: 'org-1' }],
                currentProjectId: 'project-a',
            });
        });

        it('declares the session ephemeral instead of silently discarding work', async () => {
            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().isEphemeralSession).toBe(true);
            });
        });

        it('does not spend doomed round-trips on a load or save that rules will deny', async () => {
            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().isEphemeralSession).toBe(true);
            });

            useVideoEditorStore.getState().addTrack('audio');
            await vi.advanceTimersByTimeAsync(60000);

            expect(PersistenceService.loadVideoProject).not.toHaveBeenCalled();
            expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();
        });

        it('presents an ephemeral session as a limitation, not as a load failure', async () => {
            renderHook(() => useVideoProjectPersistence());
            await vi.waitFor(() => {
                expect(useVideoEditorStore.getState().isEphemeralSession).toBe(true);
            });
            // The blocking error screen must NOT appear — the editor stays usable.
            expect(useVideoEditorStore.getState().projectLoadError).toBeNull();
            expect(useVideoEditorStore.getState().isLoadingProject).toBe(false);
        });
    });

    // Regression: ISSUE-1195 — save failures were a logger.warn and nothing else.
    it('surfaces a save failure to the UI (ISSUE-1195)', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });
        vi.mocked(PersistenceService.saveVideoProject).mockResolvedValue({
            success: false,
            reason: 'Missing or insufficient permissions.',
        });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        useVideoEditorStore.getState().addTrack('audio');
        await vi.advanceTimersByTimeAsync(5000);

        await vi.waitFor(() => {
            expect(useVideoEditorStore.getState().projectSaveError).toBe('Missing or insufficient permissions.');
        });
    });

    // Regression: overlapping autosaves (debounce + interval + visibility +
    // unmount flushes can all fire while a transaction is in flight). Two
    // concurrent saves sharing one revision token would make the loser hit
    // the service's ConflictError — a spurious "could not save" banner even
    // though the write landed. Saves must be serialized, and a coalesced
    // trailing save must use the advanced token, never the stale one.
    it('coalesces overlapping autosaves so no two saves ever share a revision token', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });

        let resolveFirstSave: (result: Awaited<ReturnType<typeof PersistenceService.saveVideoProject>>) => void = () => { };
        const firstSave = new Promise<Awaited<ReturnType<typeof PersistenceService.saveVideoProject>>>((resolve) => {
            resolveFirstSave = resolve;
        });
        vi.mocked(PersistenceService.saveVideoProject)
            // Debounced save #1 — held open while the user keeps editing.
            .mockImplementationOnce(() => firstSave)
            // Coalesced trailing save — resolves with the advanced token.
            .mockResolvedValue({ success: true, token: token('project-a', 2) });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        // Mutation → debounce fires → save #1 starts and stays in flight.
        useVideoEditorStore.getState().addTrack('audio');
        await vi.advanceTimersByTimeAsync(5000);
        expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(1);

        // More edits while save #1 is still in flight → second debounce fires.
        useVideoEditorStore.getState().addTrack('video');
        await vi.advanceTimersByTimeAsync(5000);

        // The second request must NOT start a concurrent save.
        expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(1);

        // Save #1 settles; the trailing save runs with the ADVANCED token.
        resolveFirstSave({ success: true, token: token('project-a', 1) });
        await vi.waitFor(() => {
            expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(2);
        });

        const calls = vi.mocked(PersistenceService.saveVideoProject).mock.calls;
        expect(calls[0]?.[0].revision).toBeNull();
        expect(calls[1]?.[0].revision).toBe(1);

        // No spurious failure banner.
        expect(useVideoEditorStore.getState().projectSaveError).toBeNull();
    });

    it('does not surface a false failure when a coalesced trailing save also succeeds', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue({
            status: 'absent',
            token: token('project-a'),
        });
        let resolveFirstSave: (result: Awaited<ReturnType<typeof PersistenceService.saveVideoProject>>) => void = () => { };
        const firstSave = new Promise<Awaited<ReturnType<typeof PersistenceService.saveVideoProject>>>((resolve) => {
            resolveFirstSave = resolve;
        });
        vi.mocked(PersistenceService.saveVideoProject)
            .mockImplementationOnce(() => firstSave)
            .mockResolvedValue({ success: true, token: token('project-a', 1) });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        useVideoEditorStore.getState().addTrack('audio');
        await vi.advanceTimersByTimeAsync(5000);
        useVideoEditorStore.getState().addTrack('video');
        await vi.advanceTimersByTimeAsync(5000);

        resolveFirstSave({ success: true, token: token('project-a', 1) });
        await vi.waitFor(() => {
            expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(2);
        });

        expect(useVideoEditorStore.getState().projectSaveError).toBeNull();
    });
});
