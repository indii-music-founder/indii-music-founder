/**
 * WorkspaceSyncService — Cross-Device Workspace State Replication
 *
 * Enables a user to leave their workspace on one device (laptop) and resume on another (iPad)
 * by persisting the workspace snapshot to Firestore. The snapshot captures the working state:
 * conversation, seated agents, active plan, current module, and notes.
 *
 * Collection structure:
 *   users/{userId}/workspace/current  ← single workspace doc (snapshot + metadata)
 *
 * Security: isOwner(userId) — only the authenticated user touches their workspace.
 * Phase 1 (Resume/Handoff): One-shot pull on auth ready, continuous debounced push.
 * Phase 2 (Live Mirror): Swap to onSnapshot listener, field-level merge, presence heartbeat.
 */

import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
    type Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';

export interface WorkspaceSnapshot {
    schemaVersion: number;
    activeAgents: string[];
    referencedAssets: unknown[];
    selectedPlan: unknown | null;
    selectedPlanId: string | null;
    currentModule: string;
    conversationMode: string;
    notes: unknown[];
    selectedNoteId: string | null;
    creativePrompt: string;
}

export interface WorkspaceDoc {
    snapshot: WorkspaceSnapshot;
    updatedAt: Timestamp | ReturnType<typeof serverTimestamp>;
    deviceId: string;
    appVersion?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(): string | null {
    return getRealAuthenticatedUserId(auth.currentUser);
}

function getWorkspaceRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return doc(db, 'users', uid, 'workspace', 'current');
}

const DEVICE_ID_KEY = 'indii-workspace-device-id';

function generateDeviceId(): string {
    return `device-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
}

function getDeviceId(): string {
    if (typeof window === 'undefined') return generateDeviceId();

    try {
        const cached = localStorage.getItem(DEVICE_ID_KEY);
        if (cached) return cached;

        const generated = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, generated);
        return generated;
    } catch (error) {
        logger.debug('[WorkspaceSync] Unable to cache device ID:', error as unknown);
        return generateDeviceId();
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class WorkspaceSyncService {
    constructor() {
        if (typeof process !== 'undefined' && process.env.VITEST) {
            return;
        }
    }

    /**
     * Push a workspace snapshot to Firestore.
     * Writes to users/{uid}/workspace/current with merge: true to avoid clobbering other fields.
     */
    async pushSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
        const ref = getWorkspaceRef();
        if (!ref) {
            logger.warn('[WorkspaceSync] No auth — cannot push snapshot');
            return;
        }

        const doc: WorkspaceDoc = {
            snapshot,
            updatedAt: serverTimestamp(),
            deviceId: getDeviceId(),
            appVersion: typeof window !== 'undefined' && (window as any).__APP_VERSION__
                ? (window as any).__APP_VERSION__
                : '1.55.3',
        };

        try {
            await setDoc(ref, doc, { merge: true });
            logger.info('[WorkspaceSync] 💾 Snapshot pushed successfully');
        } catch (error) {
            logger.error('[WorkspaceSync] Push failed:', error);
        }
    }

    /**
     * Pull the latest workspace snapshot from Firestore (one-shot read).
     * Returns null if no snapshot exists or if fetch fails.
     */
    async pullSnapshot(): Promise<WorkspaceDoc | null> {
        const ref = getWorkspaceRef();
        if (!ref) {
            logger.warn('[WorkspaceSync] No auth — cannot pull snapshot');
            return null;
        }

        try {
            const snapshot = await getDoc(ref);
            if (!snapshot.exists()) {
                logger.info('[WorkspaceSync] 📭 No workspace snapshot in cloud');
                return null;
            }

            const data = snapshot.data() as WorkspaceDoc;
            logger.info('[WorkspaceSync] 📂 Snapshot pulled successfully');
            return data;
        } catch (error) {
            logger.error('[WorkspaceSync] Pull failed:', error);
            return null;
        }
    }

    /**
     * Subscribe to workspace snapshot changes (for Phase 2 live mirror).
     * Calls back with each snapshot update in real-time.
     * Defined now but not used in Phase 1 (resume/handoff); reserved for Phase 2.
     */
    subscribe(callback: (doc: WorkspaceDoc | null) => void): Unsubscribe {
        const ref = getWorkspaceRef();
        if (!ref) {
            logger.warn('[WorkspaceSync] No auth — cannot subscribe');
            return () => { };
        }

        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data({ serverTimestamps: 'estimate' }) as WorkspaceDoc);
            } else {
                callback(null);
            }
        }, (error) => {
            logger.error('[WorkspaceSync] Subscribe listener error:', error);
        });
    }

    /**
     * Check if user is authenticated.
     */
    isAuthenticated(): boolean {
        return getUserId() !== null;
    }

    /**
     * Get the stable device ID for this browser/device.
     */
    getDeviceId(): string {
        return getDeviceId();
    }
}

export const workspaceSyncService = new WorkspaceSyncService();
