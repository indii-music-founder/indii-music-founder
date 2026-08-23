/**
 * studioExecutorCore.wiring — HOST-SPECIFIC default bindings for the Studio
 * Executor Core (browser/renderer edition).
 *
 * This module is the ONLY place allowed to touch `document`/`window` and the
 * Firebase singletons on the Core's behalf. StudioExecutorCore.ts itself is
 * lint-banned from both so it stays portable to Electron main/utilityProcess
 * (Phase 6) by swapping this wiring for another host module.
 */

import { auth, db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import type { RemoteCommand } from '@/services/agent/RemoteRelayService';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { studioExecutorLeaseService } from '@/services/agent/StudioExecutorLeaseService';
import { parseRemoteCommand } from '@/hooks/remoteCommandSecurity';
import { resolveRemoteCommandExecutionTarget } from '@/services/agent/RemoteRelayService';
import { createRendererExecutionAdapter } from './rendererExecutionAdapter';
import type { ExecutorCoreDeps } from './studioExecutorContracts';
import { StudioExecutorCore } from './StudioExecutorCore';

async function defaultScanPending(uid: string): Promise<Array<RemoteCommand & { id: string }>> {
    const cmdsRef = collection(db, 'users', uid, 'remote-relay-commands');
    const q = query(cmdsRef, where('status', '==', 'pending'));
    const querySnap = await getDocs(q);
    return querySnap.docs.map(docSnap => ({ ...(docSnap.data() as RemoteCommand), id: docSnap.id }));
}

function defaultWriteDiagnostic(stage: string, details?: Record<string, unknown>): Promise<void> {
    const uid = getRealAuthenticatedUserId(auth.currentUser);
    if (!uid) return Promise.resolve();
    if (isFirebaseE2EMockEnabled()) return Promise.resolve();

    try {
        return setDoc(doc(db, 'users', uid, 'remote-relay', 'diagnostics'), {
            stage,
            timestamp: serverTimestamp(),
            uid: uid.substring(0, 8),
            ...details,
        }, { merge: true }).catch(() => undefined);
    } catch {
        return Promise.resolve();
    }
}

/** Assembles a production-wired Core: real relay, real lease claims, renderer adapter. */
export function createDefaultStudioExecutorCore(): StudioExecutorCore {
    const deps: ExecutorCoreDeps = {
        relay: remoteRelayService,
        lease: { claim: (id, instance) => studioExecutorLeaseService.claimCommand(id, instance) },
        adapter: createRendererExecutionAdapter(),
        shouldProcess: (command) => resolveRemoteCommandExecutionTarget(command) === 'studio',
        parse: (text) => parseRemoteCommand(text),
        getUserId: () => getRealAuthenticatedUserId(auth.currentUser),
        scanPending: async () => {
            const uid = getRealAuthenticatedUserId(auth.currentUser);
            if (!uid) return [];
            return defaultScanPending(uid);
        },
        writeDiagnostic: defaultWriteDiagnostic,
        subscribeVisibility: (cb) => {
            if (typeof document === 'undefined') return () => undefined;
            const onVisible = () => {
                if (document.visibilityState === 'visible') cb();
            };
            document.addEventListener('visibilitychange', onVisible);
            return () => document.removeEventListener('visibilitychange', onVisible);
        },
    };
    return new StudioExecutorCore(deps);
}
