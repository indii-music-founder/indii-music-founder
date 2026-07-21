import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVideoProjectPersistence } from './useVideoProjectPersistence';
import { useVideoEditorStore, blankProjectForId, INITIAL_PROJECT } from '@/modules/creative/video/store/videoEditorStore';
import { useStore } from '@/core/store';
import * as PersistenceService from '@/modules/creative/video/services/VideoProjectPersistenceService';

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

describe('useVideoProjectPersistence', () => {
    const mockUser = { uid: 'test-user-123' };

    beforeEach(() => {
        vi.useFakeTimers();
        useVideoEditorStore.setState({ project: INITIAL_PROJECT, isLoadingProject: false });
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
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue(existingProject);

        renderHook(() => useVideoProjectPersistence());

        await vi.waitFor(() => {
            expect(useVideoEditorStore.getState().project.name).toBe('Saved Timeline');
        });
        expect(PersistenceService.loadVideoProject).toHaveBeenCalledWith('project-a');
    });

    it('starts a blank project scoped to the ID when no doc exists — isolation fix (ISSUE-1147)', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue(null);

        renderHook(() => useVideoProjectPersistence());

        await vi.waitFor(() => {
            expect(useVideoEditorStore.getState().project.id).toBe('project-a');
        });
        expect(useVideoEditorStore.getState().project.clips).toEqual([]);
    });

    it('debounce-saves 5s after a project mutation, not on every keystroke', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue(null);
        vi.mocked(PersistenceService.saveVideoProject).mockResolvedValue({ success: true });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        useVideoEditorStore.getState().addTrack('audio');
        expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5000);
        expect(PersistenceService.saveVideoProject).toHaveBeenCalledTimes(1);
    });

    it('does not resave an already-synced project on the interval tick', async () => {
        vi.mocked(PersistenceService.loadVideoProject).mockResolvedValue(null);
        vi.mocked(PersistenceService.saveVideoProject).mockResolvedValue({ success: true });

        renderHook(() => useVideoProjectPersistence());
        await vi.waitFor(() => expect(useVideoEditorStore.getState().project.id).toBe('project-a'));

        await vi.advanceTimersByTimeAsync(30000);
        expect(PersistenceService.saveVideoProject).not.toHaveBeenCalled();
    });
});
