/**
 * WorkspaceSyncService — Cross-Device Workspace State Replication
 *
 * Enables a user to leave their workspace on one device (laptop) and resume on another (iPad)
 * by persisting the workspace snapshot to Firestore. The snapshot captures the working state:
 * conversation, seated agents, active plan, current module, and notes.
 *
 * Collection structure:
 *   users/{userId}/workspace/{scopeId}  ← one snapshot per artist/studio scope
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
import type { ReferencedAsset } from '@/core/store/slices/boardroomSlice';
import type { Note } from '@/core/store/slices/notesSlice';
import type { LivingPlan } from '@/services/agent/LivingPlanService';
import type { ModuleId } from '@/core/constants';
import type { ConversationMode } from '@/core/store/slices/agent/agentUISlice';

export interface WorkspaceSnapshot {
    schemaVersion: number;
    activeAgents: string[];
    referencedAssets: ReferencedAsset[];
    selectedPlan: LivingPlan | null;
    selectedPlanId: string | null;
    currentModule: ModuleId;
    conversationMode: ConversationMode;
    notes: Note[];
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

/**
 * The organization selector is the artist/studio boundary for a founder account.
 * Keep the unresolved legacy selector separate from named studios, and reject
 * invalid Firestore document IDs instead of silently collapsing them together.
 */
export function normalizeWorkspaceScope(scopeId?: string | null): string {
    const normalized = scopeId?.trim();
    if (!normalized || normalized === 'org-default') return 'personal';
    if (normalized.includes('/')) {
        throw new Error('Workspace scope must not contain a path separator.');
    }
    return normalized;
}

function getWorkspaceRef(scopeId?: string | null) {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return doc(db, 'users', uid, 'workspace', normalizeWorkspaceScope(scopeId));
}

/**
 * Firestore rejects any `undefined` value anywhere in a written document tree.
 * `LivingPlan.approvedAt`/`.executionRef` are optional TS fields, which means the
 * runtime object can carry an explicit `undefined` key rather than omitting it —
 * setDoc() throws invalid-argument on the whole write in that case. Strip
 * recursively rather than widening this to every Firestore write in the app.
 *
 * Only recurses into plain objects/arrays. Firestore `Timestamp` instances and
 * `serverTimestamp()` FieldValue sentinels are class instances, not plain
 * objects — Object.entries() on those would shred their prototype and break
 * the sentinel Firestore's SDK detects by identity, so they pass through as-is.
 */
function stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(stripUndefinedDeep) as unknown as T;
    }
    if (value !== null && typeof value === 'object' && value.constructor === Object) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            if (val !== undefined) {
                result[key] = stripUndefinedDeep(val);
            }
        }
        return result as T;
    }
    return value;
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
     * Writes to the active artist/studio scope with merge: true to avoid clobbering other fields.
     *
     * Returns the server-assigned write time in epoch millis (or 0 when the
     * write result carries none, e.g. E2E mock mode). Callers use this as the
     * last-push timestamp for the cross-device last-write-wins comparison —
     * comparing a local `Date.now()` against the cloud's server timestamp is
     * wrong under any device clock skew.
     */
    async pushSnapshot(snapshot: WorkspaceSnapshot, scopeId?: string | null): Promise<number> {
        if (isFirebaseE2EMockEnabled()) return 0;

        const ref = getWorkspaceRef(scopeId);
        if (!ref) {
            throw new Error('Workspace sync requires an authenticated user.');
        }

        const appVersion = import.meta.env.VITE_APP_VERSION?.trim();
        const workspaceDoc: WorkspaceDoc = {
            snapshot: stripUndefinedDeep(snapshot),
            updatedAt: serverTimestamp(),
            deviceId: getDeviceId(),
            ...(appVersion ? { appVersion } : {}),
        };

        try {
            await setDoc(ref, workspaceDoc, { merge: true });
            // Read back the server-assigned write time. The renderer compares
            // this against the cloud timestamp of another device's write for
            // last-write-wins; a local `Date.now()` would be wrong under any
            // device clock skew.
            const written = await getDoc(ref);
            const storedUpdatedAt = written.data()?.updatedAt;
            const serverMillis = storedUpdatedAt && typeof storedUpdatedAt === 'object' && 'toMillis' in storedUpdatedAt
                ? Number((storedUpdatedAt as { toMillis: () => number }).toMillis())
                : 0;
            logger.info('[WorkspaceSync] 💾 Snapshot pushed successfully');
            return Number.isFinite(serverMillis) ? serverMillis : 0;
        } catch (error) {
            logger.error('[WorkspaceSync] Push failed:', error);
            throw error;
        }
    }

    /**
     * Pull the latest workspace snapshot from Firestore (one-shot read).
     * Returns null if no snapshot exists or if fetch fails.
     */
    async pullSnapshot(scopeId?: string | null): Promise<WorkspaceDoc | null> {
        if (isFirebaseE2EMockEnabled()) return null;
        
        const ref = getWorkspaceRef(scopeId);
        if (!ref) {
            throw new Error('Workspace sync requires an authenticated user.');
        }

        try {
            const snapshot = await getDoc(ref);
            if (!snapshot.exists()) {
                logger.info('[WorkspaceSync] 📭 No workspace snapshot in cloud');
                return null;
            }

            const data = snapshot.data();
            logger.info('[WorkspaceSync] 📂 Snapshot pulled successfully');
            return data as WorkspaceDoc;
        } catch (error) {
            logger.error('[WorkspaceSync] Pull failed:', error);
            throw error;
        }
    }

    /**
     * Subscribe to workspace snapshot changes (for Phase 2 live mirror).
     * Calls back with each snapshot update in real-time.
     * Defined now but not used in Phase 1 (resume/handoff); reserved for Phase 2.
     */
    subscribe(callback: (doc: WorkspaceDoc | null) => void, scopeId?: string | null): Unsubscribe {
        const ref = getWorkspaceRef(scopeId);
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
