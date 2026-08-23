/**
 * useRemoteCommandListener — React mount point for the Studio Executor Core.
 *
 * Phase 2/3 of REMOTE_EXECUTOR_CORE_PLAN: every Category-A responsibility
 * (presence/heartbeat, subscriptions, claiming, locks/watchdog, backlog
 * sweeps, diagnostics, relay hygiene) now lives in the framework-free
 * StudioExecutorCore (`services/remote/StudioExecutorCore.ts`); all Indii
 * execution lives behind the StudioExecutionAdapter
 * (`services/remote/rendererExecutionAdapter.ts`). This hook is ONLY the
 * mount boundary: it wires auth/surface gating and starts/stops the Core.
 *
 * Single-executor invariant (plan §12): exactly one Core runs per mounted
 * Studio surface; unmount stops it deterministically.
 *
 * Compatibility re-exports below keep every previously exported symbol
 * importable from this module.
 */

import { useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { createDefaultStudioExecutorCore } from '@/services/remote/studioExecutorCore.wiring';
import type { StudioExecutorCore } from '@/services/remote/StudioExecutorCore';
import { isAnonymousOrDemoUser } from '@/utils/authGuards';

// Compatibility re-exports — implementations moved to the executor modules.
export {
    isValidCoordinate,
    saveCaptureNoteDirectly,
    buildLiveMomentNote,
    buildComputerTaskInstruction,
    validateComputerTaskDispatch,
    resolveShowMeResponse,
    collectRemoteAgentResponses,
} from '@/services/remote/rendererExecutionAdapter';
export type { ShowMeResponse } from '@/services/remote/rendererExecutionAdapter';
export {
    MAX_REMOTE_AGENT_RESPONSES,
} from '@/services/remote/studioExecutorContracts';
export { shouldProcessStudioCommand } from '@/services/remote/studioExecutorContracts';

export function useRemoteCommandListener(executorSurfaceEnabled = true): void {
    const { user } = useStore(useShallow(state => ({ user: state.user })));

    useEffect(() => {
        logger.info('[RemoteRelay] 🔐 Setting up auth listener...');
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            logger.info(`[RemoteRelay] 🔐 Auth state changed: ${nextUser ? 'SIGNED IN (' + nextUser.uid.substring(0, 8) + ')' : 'SIGNED OUT'}`);
        });
        return unsubscribe;
    }, []);

    // Disable remote command listener completely for guest sessions or mock user to prevent
    // console permission errors and unneeded firestore polling.
    const isAuthenticated = !isAnonymousOrDemoUser(user) && !!user;
    const isGuest = isAnonymousOrDemoUser(user);
    const shouldEnableRelay = executorSurfaceEnabled && isAuthenticated && !isGuest;

    useEffect(() => {
        if (!shouldEnableRelay) return;

        let core: StudioExecutorCore | null = createDefaultStudioExecutorCore();
        core.start();
        logger.info('[RemoteRelay/Firestore] ⚡ Studio Executor Core mounted');

        return () => {
            void core?.stop();
            core = null;
            logger.info('[RemoteRelay/Firestore] ⏸️ Studio Executor Core stopped');
        };
    }, [shouldEnableRelay]);
}
