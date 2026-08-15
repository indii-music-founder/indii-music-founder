/**
 * useWorkspaceSync — Cross-Device Workspace Synchronization Hook
 *
 * Manages bidirectional workspace sync:
 * 1. Push: Debounced (3–5s) snapshot write when root store or plan changes
 * 2. Pull: One-shot rehydrate on auth ready, with last-write-wins (LWW) conflict detection
 *
 * Mount this hook at root level (App.tsx) to ensure sync runs for the session lifetime.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useStore, getWorkspaceSnapshot, applyWorkspaceSnapshot, resetStoreForWorkspaceBoundary } from '@/core/store';
import { useLivingPlanSlice } from '@/core/store/slices/livingPlanSlice';
import { normalizeWorkspaceScope, workspaceSyncService } from '@/services/sync/WorkspaceSyncService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function useWorkspaceSync(): void {
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPushTimeRef = useRef<number>(0);
    const hydratedUserIdRef = useRef<string | null>(null);
    const pendingPushRef = useRef<boolean>(false);
    const userId = useStore(state => state.user?.uid ?? null);
    const organizationId = useStore(state => state.currentOrganizationId);
    const workspaceScope = normalizeWorkspaceScope(organizationId);
    const activeUserIdRef = useRef<string | null>(userId);
    const activeWorkspaceScopeRef = useRef(workspaceScope);
    const previousWorkspaceKeyRef = useRef<string | null>(null);
    activeUserIdRef.current = userId;
    activeWorkspaceScopeRef.current = workspaceScope;

    // -----------------------------------------------------------------------
    // Push / Debounced Store Subscription (define first for use in Pull)
    // -----------------------------------------------------------------------

    const queuePush = useCallback(() => {
        pendingPushRef.current = true;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
            const activeUserId = activeUserIdRef.current;
            const activeWorkspaceScope = activeWorkspaceScopeRef.current;
            if (
                !activeUserId ||
                auth.currentUser?.uid !== activeUserId ||
                hydratedUserIdRef.current !== `${activeUserId}:${activeWorkspaceScope}`
            ) {
                logger.debug('[WorkspaceSync] Workspace is not safely hydrated for the active user; skipping push');
                return;
            }

            const state = useStore.getState();
            const snapshot = getWorkspaceSnapshot(state);

            try {
                await workspaceSyncService.pushSnapshot(snapshot, activeWorkspaceScope);
                lastPushTimeRef.current = Date.now();
                pendingPushRef.current = false;
            } catch (error) {
                logger.error('[WorkspaceSync] Debounced push failed; local state remains unsynced:', error);
            }
        }, 4000); // 4 second debounce (within 3–5s range)
    }, []);

    // -----------------------------------------------------------------------
    // Pull / Rehydrate (on auth ready)
    // -----------------------------------------------------------------------

    useEffect(() => {
        const workspaceKey = userId ? `${userId}:${workspaceScope}` : null;
        const previousWorkspaceKey = previousWorkspaceKeyRef.current;
        const wasHydrated = previousWorkspaceKey !== null && hydratedUserIdRef.current === previousWorkspaceKey;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        hydratedUserIdRef.current = null;
        lastPushTimeRef.current = 0;
        pendingPushRef.current = false;
        previousWorkspaceKeyRef.current = workspaceKey;

        if (!userId) {
            return;
        }

        if (previousWorkspaceKey !== null && previousWorkspaceKey !== workspaceKey && wasHydrated) {
            resetStoreForWorkspaceBoundary();
        }

        let active = true;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;

        const markHydrated = () => {
            hydratedUserIdRef.current = `${userId}:${workspaceScope}`;
            if (pendingPushRef.current) queuePush();
        };

        const rehydrate = async () => {
            if (!active || hydratedUserIdRef.current === `${userId}:${workspaceScope}`) return;

            try {
                if (auth.currentUser?.uid !== userId) {
                    throw new Error('Firebase Auth is not ready for the active workspace user.');
                }

                logger.info(`[WorkspaceSync] Pulling workspace snapshot (attempt ${attempt + 1})...`);
                const cloudDoc = await workspaceSyncService.pullSnapshot(workspaceScope);

                if (!active) return;

                if (!cloudDoc) {
                    logger.info('[WorkspaceSync] No cloud snapshot found, keeping local state');
                    markHydrated();
                    return;
                }

                const { snapshot, updatedAt, deviceId } = cloudDoc;
                const currentDeviceId = workspaceSyncService.getDeviceId();

                // Echo guard: don't apply our own writes
                if (deviceId === currentDeviceId) {
                    logger.info('[WorkspaceSync] Cloud snapshot is from this device, skipping');
                    markHydrated();
                    return;
                }

                // LWW logic: check if cloud is newer than local
                const toMillis = updatedAt && typeof updatedAt === 'object' && 'toMillis' in updatedAt
                    ? (updatedAt as { toMillis?: unknown }).toMillis
                    : undefined;
                const cloudTime = typeof toMillis === 'function'
                    ? toMillis.call(updatedAt)
                    : 0;
                const localTime = lastPushTimeRef.current;

                if (cloudTime <= localTime) {
                    logger.info('[WorkspaceSync] Local state is newer or equal, keeping local');
                    markHydrated();
                    return;
                }

                // Cloud is newer and from another device → show conflict prompt
                const shouldLoad = await ConfirmDialog.call({
                    message: 'A newer workspace from another device is available. Load it now? This will replace your current workspace state.',
                });

                if (!active) return;

                if (shouldLoad) {
                    logger.info('[WorkspaceSync] User confirmed, applying cloud snapshot');
                    applyWorkspaceSnapshot(snapshot);
                } else {
                    logger.info('[WorkspaceSync] User declined, keeping local state');
                    // Schedule a push so local state overrides cloud
                    queuePush();
                }

                markHydrated();
            } catch (error) {
                logger.error('[WorkspaceSync] Rehydrate failed:', error);
                // A failed read is not evidence that the cloud document is absent.
                // Keep pushes paused and retry a bounded number of times so a
                // transient outage cannot turn stale local state into authority.
                attempt += 1;
                if (active && attempt < 3) {
                    retryTimer = setTimeout(() => {
                        void rehydrate();
                    }, attempt * 2_000);
                } else {
                    logger.error('[WorkspaceSync] Rehydrate remains unavailable; cloud pushes are paused to prevent overwrite.');
                }
            }
        };

        const handleOnline = () => {
            if (hydratedUserIdRef.current !== `${userId}:${workspaceScope}`) {
                attempt = 0;
                if (retryTimer) clearTimeout(retryTimer);
                void rehydrate();
            }
        };

        window.addEventListener('online', handleOnline);
        void rehydrate();

        return () => {
            active = false;
            if (retryTimer) clearTimeout(retryTimer);
            window.removeEventListener('online', handleOnline);
        };
    }, [queuePush, userId, workspaceScope]);

    // -----------------------------------------------------------------------
    // Subscribe to Store Changes (uses queuePush defined above)
    // -----------------------------------------------------------------------

    useEffect(() => {
        // Defensive: ensure stores have subscribe method before mounting listeners
        if (typeof useStore.subscribe !== 'function' || typeof useLivingPlanSlice.subscribe !== 'function') {
            logger.warn('[WorkspaceSync] Store subscribe methods unavailable, skipping sync setup');
            return;
        }

        let prevRootState = useStore.getState();
        let prevPlanState = useLivingPlanSlice.getState();

        // Subscribe to root store changes
        const unsubRoot = useStore.subscribe((state) => {
            // Shallow check: if major fields changed, queue a push
            if (
                state.activeAgents !== prevRootState.activeAgents ||
                state.referencedAssets !== prevRootState.referencedAssets ||
                state.currentModule !== prevRootState.currentModule ||
                state.conversationMode !== prevRootState.conversationMode ||
                state.notes !== prevRootState.notes ||
                state.selectedNoteId !== prevRootState.selectedNoteId ||
                state.creativePrompt !== prevRootState.creativePrompt
            ) {
                queuePush();
            }
            prevRootState = state;
        });

        // Subscribe to plan slice changes
        const unsubPlan = useLivingPlanSlice.subscribe((state) => {
            if (
                state.selectedPlan !== prevPlanState.selectedPlan ||
                state.selectedPlanId !== prevPlanState.selectedPlanId
            ) {
                queuePush();
            }
            prevPlanState = state;
        });

        return () => {
            unsubRoot();
            unsubPlan();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [queuePush]);
}
