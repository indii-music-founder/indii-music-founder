import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';
import {
    loadVideoProject,
    saveVideoProject,
    type WriteToken,
} from '@/modules/creative/video/services/VideoProjectPersistenceService';
import { logger } from '@/utils/logger';

const AUTOSAVE_DEBOUNCE_MS = 5000;
const AUTOSAVE_INTERVAL_MS = 30000;

/**
 * ISSUE-1147: keys the video editor's persisted document to the app's currently
 * open project.
 *
 * ISSUE-1193 (repair-order step 1): this hook used to treat a failed load as
 * "no timeline yet", reset the store to a blank project, and then autosave that
 * blank over the real document. It now holds a `WriteToken` that only a
 * successful load can produce, and `saveVideoProject` cannot be called without
 * one — so an unbacked write is a type error rather than a runtime hazard.
 *
 * On a load error the store is left untouched, autosave is disabled for the
 * session, and the editor renders an explicit error state (ISSUE-1195).
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

    // Tracks the project reference that was last successfully persisted (or just
    // loaded). Every store mutation replaces `project` with a new object, so
    // identity comparison is a reliable, zero-cost dirty check.
    const lastSyncedProjectRef = useRef<unknown>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedProjectIdRef = useRef<string | null>(null);
    // The permission to write. Absent until a load establishes what is stored.
    const tokenRef = useRef<WriteToken | null>(null);

    const save = useCallback(async () => {
        const { project } = useVideoEditorStore.getState();
        const token = tokenRef.current;

        // No token means we never established what is stored for this project.
        // Writing here is exactly the ISSUE-1193 data-loss path.
        if (!token || !user || project === lastSyncedProjectRef.current) return;
        if (token.projectId !== project.id) return;

        const result = await saveVideoProject(token, project, user.uid, resolvedOrgId);
        if (result.success && result.token) {
            tokenRef.current = result.token;
            lastSyncedProjectRef.current = project;
            useVideoEditorStore.getState().setProjectSaveError(null);
        } else {
            // Surfaced, not just logged — a silent warn is how work disappears.
            logger.warn(`[VideoProjectPersistence] Save failed: ${result.reason}`);
            useVideoEditorStore.getState().setProjectSaveError(
                result.reason ?? 'Could not save your timeline.'
            );
        }
    }, [user, resolvedOrgId]);

    // Load (or start fresh) whenever the app's active project changes.
    useEffect(() => {
        if (!currentProjectId || !user) return;
        if (loadedProjectIdRef.current === currentProjectId) return;
        loadedProjectIdRef.current = currentProjectId;

        // A new project means the previous token no longer authorises anything.
        tokenRef.current = null;

        let cancelled = false;
        const store = useVideoEditorStore.getState();
        store.setProjectLoadError(null);
        store.setProjectSaveError(null);
        store.setIsLoadingProject(true);

        loadVideoProject(currentProjectId, user.uid)
            .then(result => {
                if (cancelled) return;
                const s = useVideoEditorStore.getState();

                if (result.status === 'error') {
                    // Do NOT reset the store. We do not know what is stored, so the
                    // only safe posture is read-only with a visible error.
                    s.setProjectLoadError(
                        'Could not load this project’s timeline. Your saved work has not been changed. Retry before editing.'
                    );
                    s.setIsLoadingProject(false);
                    return;
                }

                if (result.status === 'found') {
                    s.loadProjectFromDoc(result.project);
                    lastSyncedProjectRef.current = result.project;
                } else {
                    s.resetProjectForId(currentProjectId);
                    // Re-read: `s` is a snapshot taken before the reset, so `s.project`
                    // is the OUTGOING project. Storing that as the synced baseline
                    // would make the dirty check always fire and resave on every tick.
                    lastSyncedProjectRef.current = useVideoEditorStore.getState().project;
                }
                tokenRef.current = result.token;
                s.setIsLoadingProject(false);
            })
            .catch(error => {
                // Belt and braces: the service catches its own errors, but an
                // unhandled rejection here used to leave the editor spinning forever.
                if (cancelled) return;
                logger.error('[VideoProjectPersistence] Unexpected load rejection:', error);
                const s = useVideoEditorStore.getState();
                s.setProjectLoadError('Could not load this project’s timeline.');
                s.setIsLoadingProject(false);
            });

        return () => {
            cancelled = true;
        };
    }, [currentProjectId, user]);

    // Debounced autosave on every project mutation.
    useEffect(() => {
        const unsub = useVideoEditorStore.subscribe((state, prevState) => {
            if (state.project === prevState.project) return;
            if (!tokenRef.current) return;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                saveTimeoutRef.current = null;
                void save();
            }, AUTOSAVE_DEBOUNCE_MS);
        });
        return () => {
            unsub();
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [save]);

    // Interval fallback save.
    useEffect(() => {
        const intervalId = setInterval(() => void save(), AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [save]);

    // Flush when the tab is hidden. Mobile browsers routinely kill a backgrounded
    // tab without ever firing `beforeunload`, which silently discarded up to a
    // full autosave interval of edits.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') return;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            void save();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [save]);

    // Warn before losing unsaved edits.
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const { project } = useVideoEditorStore.getState();
            if (tokenRef.current && project !== lastSyncedProjectRef.current) {
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
                saveTimeoutRef.current = null;
                void save();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
