/**
 * useWorkspaceSync — Cross-Device Workspace Synchronization Hook
 *
 * Manages bidirectional workspace sync:
 * 1. Push: Debounced (3–5s) snapshot write when root store or plan changes
 * 2. Pull: One-shot rehydrate on auth ready, with last-write-wins (LWW) conflict detection
 *
 * Mount this hook at root level (App.tsx) to ensure sync runs for the session lifetime.
 */

import { useEffect, useRef } from 'react';
import { useStore, getWorkspaceSnapshot, applyWorkspaceSnapshot } from '@/core/store';
import { useLivingPlanSlice } from '@/core/store/slices/livingPlanSlice';
import { workspaceSyncService } from '@/services/sync/WorkspaceSyncService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function useWorkspaceSync(): void {
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPushTimeRef = useRef<number>(0);
    const rehydratedRef = useRef<boolean>(false);

    // -----------------------------------------------------------------------
    // Push / Debounced Store Subscription (define first for use in Pull)
    // -----------------------------------------------------------------------

    const queuePush = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (!auth.currentUser) {
                logger.debug('[WorkspaceSync] Not authenticated, skipping push');
                return;
            }

            const state = useStore.getState();
            const snapshot = getWorkspaceSnapshot(state);

            workspaceSyncService.pushSnapshot(snapshot);
            lastPushTimeRef.current = Date.now();
        }, 4000); // 4 second debounce (within 3–5s range)
    };

    // -----------------------------------------------------------------------
    // Pull / Rehydrate (on auth ready)
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!auth.currentUser || rehydratedRef.current) {
            return;
        }

        let active = true;

        const rehydrate = async () => {
            try {
                logger.info('[WorkspaceSync] Auth ready, pulling workspace snapshot...');
                const cloudDoc = await workspaceSyncService.pullSnapshot();

                if (!active) return;

                if (!cloudDoc) {
                    logger.info('[WorkspaceSync] No cloud snapshot found, keeping local state');
                    rehydratedRef.current = true;
                    return;
                }

                const { snapshot, updatedAt, deviceId } = cloudDoc;
                const currentDeviceId = workspaceSyncService.getDeviceId();

                // Echo guard: don't apply our own writes
                if (deviceId === currentDeviceId) {
                    logger.info('[WorkspaceSync] Cloud snapshot is from this device, skipping');
                    rehydratedRef.current = true;
                    return;
                }

                // LWW logic: check if cloud is newer than local
                const cloudTime = updatedAt && typeof updatedAt === 'object' && 'toMillis' in updatedAt
                    ? (updatedAt as any).toMillis()
                    : 0;
                const localTime = lastPushTimeRef.current;

                if (cloudTime <= localTime) {
                    logger.info('[WorkspaceSync] Local state is newer or equal, keeping local');
                    rehydratedRef.current = true;
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

                rehydratedRef.current = true;
            } catch (error) {
                logger.error('[WorkspaceSync] Rehydrate failed:', error);
                rehydratedRef.current = true; // Mark done even on error to avoid retry spam
            }
        };

        rehydrate();

        return () => {
            active = false;
        };
    }, [auth.currentUser]);

    // -----------------------------------------------------------------------
    // Subscribe to Store Changes (uses queuePush defined above)
    // -----------------------------------------------------------------------

    useEffect(() => {
        // Subscribe to root store changes
        const unsubRoot = useStore.subscribe(
            (state, prevState) => {
                // Shallow check: if major fields changed, queue a push
                if (
                    state.boardroomMessages !== prevState.boardroomMessages ||
                    state.activeAgents !== prevState.activeAgents ||
                    state.referencedAssets !== prevState.referencedAssets ||
                    state.currentModule !== prevState.currentModule ||
                    state.conversationMode !== prevState.conversationMode ||
                    state.notes !== prevState.notes ||
                    state.selectedNoteId !== prevState.selectedNoteId ||
                    state.creativePrompt !== prevState.creativePrompt
                ) {
                    queuePush();
                }
            }
        );

        // Subscribe to plan slice changes
        const unsubPlan = useLivingPlanSlice.subscribe(
            (state, prevState) => {
                if (
                    state.selectedPlan !== prevState.selectedPlan ||
                    state.selectedPlanId !== prevState.selectedPlanId
                ) {
                    queuePush();
                }
            }
        );

        return () => {
            unsubRoot();
            unsubPlan();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);
}
