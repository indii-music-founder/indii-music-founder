import { openDB } from 'idb';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/modules/workflow/types';
import { logger } from '@/utils/logger';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';

const DB_NAME = 'rndr-ai-db';
const STORE_NAME = 'assets';
const WORKFLOWS_STORE = 'workflows';
const PROFILE_STORE = 'profile';
const CANVAS_STORE = 'canvas_states';

// ============================================================================
// Sync Queue for offline-first asset uploads
// ============================================================================

interface SyncQueueItem {
    id: string;
    type: 'asset';
    data: Blob;
    timestamp: number;
    retryCount: number;
}

const syncQueue: Map<string, SyncQueueItem> = new Map();

function queueAssetForSync(id: string, blob: Blob): void {
    syncQueue.set(id, {
        id,
        type: 'asset',
        data: blob,
        timestamp: Date.now(),
        retryCount: 0
    });
    // Asset ${id} queued for sync (${syncQueue.size} items in queue)
}

/**
 * Process the sync queue - call this when online connectivity is restored
 */
export async function processSyncQueue(): Promise<void> {
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (!userId || syncQueue.size === 0) return;

    logger.info(`[Repository] Processing sync queue (${syncQueue.size} items)...`);

    const itemsToRemove: string[] = [];

    for (const [id, item] of syncQueue) {
        try {
            const storageRef = ref(storage, `users/${userId}/assets/${id}`);
            await uploadBytes(storageRef, item.data);
            itemsToRemove.push(id);
            logger.info(`[Repository] Successfully synced queued asset ${id}`);
        } catch (error: unknown) {
            logger.warn(`[Repository] Failed to sync queued asset ${id}:`, error);
            item.retryCount++;

            // Remove from queue after 3 failed attempts
            if (item.retryCount >= 3) {
                logger.error(`[Repository] Asset ${id} removed from queue after 3 failed attempts`);
                itemsToRemove.push(id);
            }
        }
    }

    // Clean up processed items
    itemsToRemove.forEach(id => syncQueue.delete(id));
    logger.info(`[Repository] Sync queue processed. ${syncQueue.size} items remaining.`);
}

// ============================================================================
// Database Initialization
// ============================================================================

export async function initDB() {
    return openDB(DB_NAME, 4, {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
                db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PROFILE_STORE)) {
                db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(CANVAS_STORE)) {
                db.createObjectStore(CANVAS_STORE, { keyPath: 'id' });
            }
        },
    });
}

// --- Assets (Blobs) ---

export async function saveAssetToStorage(blob: Blob): Promise<string> {
    const dbLocal = await initDB();
    const id = crypto.randomUUID();

    // 1. Save locally first (Optimistic)
    await dbLocal.put(STORE_NAME, blob, id);

    // 2. Sync to Cloud if logged in
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (userId) {
        try {
            const storageRef = ref(storage, `users/${userId}/assets/${id}`);
            await uploadBytes(storageRef, blob);
        } catch (_error: unknown) {
            // Failed to sync asset ${id} to cloud
            // Queue for retry on next sync
            queueAssetForSync(id, blob);
        }
    }

    return id;
}

export async function getAssetFromStorage(id: string): Promise<string> {
    const dbLocal = await initDB();

    // 1. Try Local
    const localBlob = await dbLocal.get(STORE_NAME, id);
    if (localBlob) {
        return URL.createObjectURL(localBlob);
    }

    // 2. Try Cloud if missing locally
    try {
        const user = auth.currentUser;
        const userId = getRealAuthenticatedUserId(user);
        if (!userId) throw new Error("Real authenticated user required for cloud fetch");

        const storageRef = ref(storage, `users/${userId}/assets/${id}`);
        const cloudBlob = await getBlob(storageRef);

        // Save to local cache
        await dbLocal.put(STORE_NAME, cloudBlob, id);

        return URL.createObjectURL(cloudBlob);
    } catch (error: unknown) {
        logger.warn(`Failed to fetch asset ${id} from cloud:`, error);
    }

    throw new Error(`Asset ${id} not found locally or in cloud`);
}

interface Workflow {
    id: string;
    [key: string]: unknown; // Allow other properties
}

interface CanvasState {
    id: string;
    json: string;
    updatedAt: string | number | Date | unknown;
}

// --- User Profile ---

export async function saveProfileToStorage(profile: UserProfile): Promise<void> {
    // IDB guard: PROFILE_STORE uses keyPath 'id' — bail early if id is missing
    // to prevent DataError from IDB when the profile hasn't fully hydrated yet.
    if (!profile?.id) {
        logger.warn('[Repository] saveProfileToStorage skipped — profile has no id');
        return;
    }

    const dbLocal = await initDB();

    // 1. Save locally
    await dbLocal.put(PROFILE_STORE, profile);

    // 2. Sync to Cloud
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (userId) {
        // Validation: Ensure we are only saving the profile for the current user
        if (profile.id !== userId) {
            // Profile ID mismatch ignoring cloud sync. Profile: ${profile.id}, Auth: ${user.uid}
            return;
        }

        const maxAttempts = 3;
        let attempt = 0;

        const runCloudSync = async () => {
            try {
                const docRef = doc(db, 'users', userId);
                await setDoc(docRef, profile, { merge: true });
            } catch (error: unknown) {
                attempt++;
                if (attempt < maxAttempts) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    logger.warn(`[Repository] Profile cloud sync failed (attempt ${attempt}/${maxAttempts}). Retrying in ${backoff}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    await runCloudSync();
                } else {
                    logger.error('[Repository] Profile cloud sync failed permanently:', error);
                    throw new Error(`Profile sync failed after ${maxAttempts} attempts: ${(error as Error).message}`);
                }
            }
        };

        await runCloudSync();
    }
}

export async function getProfileFromStorage(profileId?: string): Promise<UserProfile | undefined> {
    const dbLocal = await initDB();
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);

    // Determine target ID: passed ID > auth ID. Unauthenticated sessions do not fabricate profiles.
    const targetId = profileId || userId;

    if (!targetId) return undefined;

    // Strategy: Local First (to preserve offline/permission-denied changes)
    const localProfile = await dbLocal.get(PROFILE_STORE, targetId);
    if (localProfile) {
        logger.info('[Repository] Serving profile from Local Cache');
        // We could trigger a background sync to cloud here if needed
        return localProfile;
    }

    // 2. Try Cloud if authorized and local is missing
    if (userId && userId === targetId) {
        try {
            const docRef = doc(db, 'users', userId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const cloudProfile: UserProfile = { ...(snap.data() as UserProfile), id: snap.id };
                logger.info('[Repository] Fetched fresh profile from Cloud');

                // Update Local Cache
                await dbLocal.put(PROFILE_STORE, cloudProfile);
                return cloudProfile;
            }
        } catch (error: unknown) {
            logger.warn('[Repository] Cloud profile fetch failed:', error);
        }
    }

    return undefined;
}

// --- Workflows (JSON) ---

export async function saveWorkflowToStorage(workflow: Workflow): Promise<void> {
    const dbLocal = await initDB();
    const workflowId = workflow.id || crypto.randomUUID();
    const workflowWithId = { ...workflow, id: workflowId, updatedAt: new Date().toISOString() };

    // 1. Save locally
    await dbLocal.put(WORKFLOWS_STORE, workflowWithId);

    // 2. Sync to Cloud
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (userId) {
        try {
            const docRef = doc(db, 'users', userId, 'workflows', workflowId);
            await setDoc(docRef, { ...workflowWithId, synced: true }, { merge: true });
        } catch (_error: unknown) {
            // Failed to sync workflow ${workflowId} to cloud
        }
    }
}

export async function getWorkflowFromStorage(id: string): Promise<Workflow | undefined> {
    const dbLocal = await initDB();

    let workflow = await dbLocal.get(WORKFLOWS_STORE, id);

    if (workflow) return workflow;

    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (userId) {
        try {
            const docRef = doc(db, 'users', userId, 'workflows', id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                workflow = snap.data();
                await dbLocal.put(WORKFLOWS_STORE, workflow);
                return workflow;
            }
        } catch (_error: unknown) {
            // Failed to fetch workflow from cloud
        }
    }

    // Return undefined if not found
    return undefined;
}

// --- Canvas States (Fabric JSON) ---

export async function saveCanvasStateToStorage(id: string, json: string): Promise<void> {
    const dbLocal = await initDB();

    // 1. Save Locally
    const stateObj: CanvasState = {
        id,
        json,
        updatedAt: new Date().toISOString()
    };
    await dbLocal.put(CANVAS_STORE, stateObj);

    // 2. Sync to Cloud
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (!userId) return;

    try {
        const docRef = doc(db, 'users', userId, 'canvas_states', id);
        await setDoc(docRef, stateObj, { merge: true });
        // Saved canvas state for ${id}
    } catch (_error: unknown) {
        // Failed to sync canvas state ${id} to cloud
    }
}

export async function getCanvasStateFromStorage(id: string): Promise<string | undefined> {
    const dbLocal = await initDB();

    // 1. Try Local First
    const localState = await dbLocal.get(CANVAS_STORE, id);
    if (localState) {
        return localState.json;
    }

    // 2. Try Cloud
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (!userId) return undefined;

    try {
        const docRef = doc(db, 'users', userId, 'canvas_states', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data() as CanvasState;
            await dbLocal.put(CANVAS_STORE, data);
            return data.json;
        }
    } catch (_error: unknown) {
        // Failed to fetch canvas state from cloud
    }

    return undefined;
}

export async function getAllWorkflowsFromStorage(): Promise<Workflow[]> {
    const dbLocal = await initDB();

    // 1. Get Local
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    // 2. Merge with Cloud if logged in
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (userId) {
        try {
            const collectionRef = collection(db, 'users', userId, 'workflows');
            const snap = await getDocs(collectionRef);

            const cloudWorkflows = snap.docs.map(d => d.data());

            // Simple merge: Cloud wins if exists, else keep local (if local has ones not in cloud)
            for (const cw of cloudWorkflows) {
                await dbLocal.put(WORKFLOWS_STORE, cw);
            }

            return await dbLocal.getAll(WORKFLOWS_STORE); // Return updated local
        } catch (_error: unknown) {
            // Failed to fetch workflows from cloud
        }
    }

    return localWorkflows;
}

export async function syncWorkflows(): Promise<void> {
    const user = auth.currentUser;
    const userId = getRealAuthenticatedUserId(user);
    if (!userId) return;

    const dbLocal = await initDB();
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    // Syncing ${localWorkflows.length} workflows to cloud...

    const batchPromises = localWorkflows.map(async (wf) => {
        try {
            const docRef = doc(db, 'users', userId, 'workflows', wf.id);
            await setDoc(docRef, { ...wf, synced: true }, { merge: true });
        } catch (__e: unknown) {
            // Failed to sync workflow ${wf.id}
        }
    });

    await Promise.all(batchPromises);
    // Workflow sync complete.
}
