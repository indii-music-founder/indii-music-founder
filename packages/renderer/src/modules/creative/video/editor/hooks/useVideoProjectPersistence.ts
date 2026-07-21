import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';
import { loadVideoProject, saveVideoProject } from '@/modules/creative/video/services/VideoProjectPersistenceService';
import { logger } from '@/utils/logger';

const AUTOSAVE_DEBOUNCE_MS = 5000;
const AUTOSAVE_INTERVAL_MS = 30000;

/**
 * ISSUE-1147: keys the video editor's persisted document to the app's
 * currently open project. Mounting this hook (once, in VideoEditor.tsx):
 *  - loads the per-project doc when `currentProjectId` changes, or starts a
 *    fresh blank timeline stamped with that ID if no doc exists yet
 *  - debounce-saves edits 5s after the last change, plus a 30s interval
 *    fallback, mirroring useAutoSave.ts (merchandise module)
 *  - warns on tab close/reload if there are unsaved edits
 */
export function useVideoProjectPersistence() {
    const { user, currentOrganizationId, organizations, currentProjectId } = useStore(
        useShallow(state => ({
            user: state.user,
            currentOrganizationId: state.currentOrganizationId,
            organizations: state.organizations,
            currentProjectId: state.currentProjectId,
        }))
    );
    const activeOrg = organizations.find(org => org.id === currentOrganizationId);
    const resolvedOrgId = activeOrg?.id ?? currentOrganizationId ?? null;

    // Tracks the project reference that was last successfully persisted (or
    // just loaded). Because every store mutation replaces `project` with a
    // new object, `project !== lastSyncedProjectRef.current` is a reliable,
    // zero-cost dirty check — no separate boolean to keep in sync.
    const lastSyncedProjectRef = useRef<unknown>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstSaveRef = useRef(true);
    const loadedProjectIdRef = useRef<string | null>(null);

    const save = useCallback(async () => {
        const { project } = useVideoEditorStore.getState();
        if (!user || project === lastSyncedProjectRef.current) return;
        const result = await saveVideoProject(project.id, project, user.uid, resolvedOrgId, isFirstSaveRef.current);
        if (result.success) {
            isFirstSaveRef.current = false;
            lastSyncedProjectRef.current = project;
        } else {
            logger.warn(`[VideoProjectPersistence] Save skipped/failed: ${result.reason}`);
        }
    }, [user, resolvedOrgId]);

    // Load (or start fresh) whenever the app's active project changes.
    useEffect(() => {
        if (!currentProjectId || loadedProjectIdRef.current === currentProjectId) return;
        loadedProjectIdRef.current = currentProjectId;
        isFirstSaveRef.current = true;

        let cancelled = false;
        useVideoEditorStore.getState().setIsLoadingProject(true);
        loadVideoProject(currentProjectId).then(existing => {
            if (cancelled) return;
            if (existing) {
                useVideoEditorStore.getState().loadProjectFromDoc(existing);
                lastSyncedProjectRef.current = existing;
                isFirstSaveRef.current = false;
            } else {
                useVideoEditorStore.getState().resetProjectForId(currentProjectId);
                lastSyncedProjectRef.current = useVideoEditorStore.getState().project;
            }
            useVideoEditorStore.getState().setIsLoadingProject(false);
        });

        return () => {
            cancelled = true;
        };
    }, [currentProjectId]);

    // Debounced autosave on every project mutation.
    useEffect(() => {
        const unsub = useVideoEditorStore.subscribe((state, prevState) => {
            if (state.project === prevState.project) return;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
        });
        return () => {
            unsub();
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [save]);

    // Interval fallback save.
    useEffect(() => {
        const intervalId = setInterval(save, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [save]);

    // Warn before losing unsaved edits.
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const { project } = useVideoEditorStore.getState();
            if (project !== lastSyncedProjectRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Flush a pending save on unmount (e.g. navigating away from the editor).
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                save();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
