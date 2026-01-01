import { openDB } from 'idb';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/modules/workflow/types';

const DB_NAME = 'rndr-ai-db';
const STORE_NAME = 'assets';
const WORKFLOWS_STORE = 'workflows';
const PROFILE_STORE = 'profile';

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
    console.log(`[Repository] Asset ${id} queued for sync (${syncQueue.size} items in queue)`);
}

/**
 * Process the sync queue - call this when online connectivity is restored
 */
export async function processSyncQueue(): Promise<void> {
    const user = auth.currentUser;
    if (!user || syncQueue.size === 0) return;

    console.log(`[Repository] Processing sync queue (${syncQueue.size} items)...`);

    const itemsToRemove: string[] = [];

    for (const [id, item] of syncQueue) {
        try {
            const storageRef = ref(storage, `users/${user.uid}/assets/${id}`);
            await uploadBytes(storageRef, item.data);
            itemsToRemove.push(id);
            console.log(`[Repository] Successfully synced queued asset ${id}`);
        } catch (error) {
            console.warn(`[Repository] Failed to sync queued asset ${id}:`, error);
            item.retryCount++;

            // Remove from queue after 3 failed attempts
            if (item.retryCount >= 3) {
                console.error(`[Repository] Asset ${id} removed from queue after 3 failed attempts`);
                itemsToRemove.push(id);
            }
        }
    }

    // Clean up processed items
    itemsToRemove.forEach(id => syncQueue.delete(id));
    console.log(`[Repository] Sync queue processed. ${syncQueue.size} items remaining.`);
}

// ============================================================================
// Database Initialization
// ============================================================================

export async function initDB() {
    return openDB(DB_NAME, 3, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
                db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PROFILE_STORE)) {
                db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
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
    if (user) {
        try {
            const storageRef = ref(storage, `users/${user.uid}/assets/${id}`);
            await uploadBytes(storageRef, blob);
        } catch (error) {
            console.warn(`[Repository] Failed to sync asset ${id} to cloud:`, error);
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
        if (!user) throw new Error("User not authenticated for cloud fetch");

        const storageRef = ref(storage, `users/${user.uid}/assets/${id}`);
        const cloudBlob = await getBlob(storageRef);

        // Save to local cache
        await dbLocal.put(STORE_NAME, cloudBlob, id);

        return URL.createObjectURL(cloudBlob);
    } catch (error) {
        console.warn(`Failed to fetch asset ${id} from cloud:`, error);
    }

    throw new Error(`Asset ${id} not found locally or in cloud`);
}

interface Workflow {
    id: string;
    [key: string]: any; // Allow other properties
}

interface CanvasState {
    id: string;
    json: string;
    updatedAt: any;
}

// --- User Profile ---

export async function saveProfileToStorage(profile: UserProfile): Promise<void> {
    const dbLocal = await initDB();

    // 1. Save locally
    await dbLocal.put(PROFILE_STORE, profile);

    // 2. Sync to Cloud
    const user = auth.currentUser;
    if (user) {
        // Validation: Ensure we are only saving the profile for the current user
        if (profile.id !== user.uid) {
            console.warn(`[Repository] Profile ID mismatch ignoring cloud sync. Profile: ${profile.id}, Auth: ${user.uid}`);
            return;
        }

        try {
            const docRef = doc(db, 'users', user.uid);
            await setDoc(docRef, profile, { merge: true });
        } catch (error) {
            console.warn(`Failed to sync profile to cloud:`, error);
        }
    }
}

export async function getProfileFromStorage(profileId?: string): Promise<UserProfile | undefined> {
    const dbLocal = await initDB();
    const user = auth.currentUser;

    // Determine target ID: passed ID > auth ID > 'guest'
    const targetId = profileId || user?.uid;

    if (!targetId) return undefined;

    // 1. Try Local
    let profile = await dbLocal.get(PROFILE_STORE, targetId);
    if (profile) return profile;

    // 2. Try Cloud if missing locally and we are authorized
    if (user && user.uid === targetId) {
        try {
            const docRef = doc(db, 'users', user.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                profile = snap.data() as UserProfile;
                await dbLocal.put(PROFILE_STORE, profile);
                return profile;
            }
        } catch (error) {
            console.warn("Failed to fetch profile from cloud", error);
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
    if (user) {
        try {
            const docRef = doc(db, 'users', user.uid, 'workflows', workflowId);
            await setDoc(docRef, { ...workflowWithId, synced: true }, { merge: true });
        } catch (error) {
            console.warn(`Failed to sync workflow ${workflowId} to cloud:`, error);
        }
    }
}

export async function getWorkflowFromStorage(id: string): Promise<Workflow | undefined> {
    const dbLocal = await initDB();

    let workflow = await dbLocal.get(WORKFLOWS_STORE, id);

    if (workflow) return workflow;

    const user = auth.currentUser;
    if (user) {
        try {
            const docRef = doc(db, 'users', user.uid, 'workflows', id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                workflow = snap.data();
                await dbLocal.put(WORKFLOWS_STORE, workflow);
                return workflow;
            }
        } catch (error) {
            console.warn("Failed to fetch workflow from cloud", error);
        }
    }

    // Return undefined if not found
    return undefined;
}

// --- Canvas States (Fabric JSON) ---

export async function saveCanvasStateToStorage(id: string, json: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(db, 'users', user.uid, 'canvas_states', id);
        await setDoc(docRef, {
            id,
            json,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[Repository] Saved canvas state for ${id}`);
    } catch (error) {
        console.warn(`Failed to sync canvas state ${id} to cloud:`, error);
    }
}

export async function getCanvasStateFromStorage(id: string): Promise<string | undefined> {
    const user = auth.currentUser;
    if (!user) return undefined;

    try {
        const docRef = doc(db, 'users', user.uid, 'canvas_states', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return (snap.data() as CanvasState).json;
        }
    } catch (error) {
        console.warn("Failed to fetch canvas state from cloud", error);
    }

    return undefined;
}

export async function getAllWorkflowsFromStorage(): Promise<Workflow[]> {
    const dbLocal = await initDB();

    // 1. Get Local
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    // 2. Merge with Cloud if logged in
    const user = auth.currentUser;
    if (user) {
        try {
            const collectionRef = collection(db, 'users', user.uid, 'workflows');
            const snap = await getDocs(collectionRef);

            const cloudWorkflows = snap.docs.map(d => d.data());

            // Simple merge: Cloud wins if exists, else keep local (if local has ones not in cloud)
            for (const cw of cloudWorkflows) {
                await dbLocal.put(WORKFLOWS_STORE, cw);
            }

            return await dbLocal.getAll(WORKFLOWS_STORE); // Return updated local
        } catch (error) {
            console.warn("Failed to fetch workflows from cloud", error);
        }
    }

    return localWorkflows;
}

export async function syncWorkflows(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    const dbLocal = await initDB();
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    console.log(`Syncing ${localWorkflows.length} workflows to cloud...`);

    const batchPromises = localWorkflows.map(async (wf) => {
        try {
            const docRef = doc(db, 'users', user.uid, 'workflows', wf.id);
            await setDoc(docRef, { ...wf, synced: true }, { merge: true });
        } catch (e) {
            console.warn(`Failed to sync workflow ${wf.id}`, e);
        }
    });

    await Promise.all(batchPromises);
    console.log("Workflow sync complete.");
}
