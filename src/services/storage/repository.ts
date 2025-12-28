import { openDB } from 'idb';
import { db, storage } from '../firebase';
const CURRENT_USER_ID = 'superuser-id';
import { ref, uploadBytes, getBlob } from 'firebase/storage';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

const DB_NAME = 'rndr-ai-db';
const STORE_NAME = 'assets';
const WORKFLOWS_STORE = 'workflows';

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
    const user = { uid: CURRENT_USER_ID };
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
    return openDB(DB_NAME, 2, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
                db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' });
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
    const user = { uid: CURRENT_USER_ID };
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
        const storageRef = ref(storage, `users/${CURRENT_USER_ID}/assets/${id}`);
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

// --- Workflows (JSON) ---

export async function saveWorkflowToStorage(workflow: Workflow): Promise<void> {
    const dbLocal = await initDB();
    const workflowId = workflow.id || crypto.randomUUID();
    const workflowWithId = { ...workflow, id: workflowId, updatedAt: new Date().toISOString() };

    // 1. Save locally
    await dbLocal.put(WORKFLOWS_STORE, workflowWithId);

    // 2. Sync to Cloud
    const user = { uid: CURRENT_USER_ID };
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

    // 1. Try Cloud first for Workflows (to get latest version across devices)
    // Only if online and logged in. Otherwise fallback to local.
    // Actually, for speed, Strategy: Read Local, Check Cloud in background?
    // Let's go with: Try Local. If not found, Try Cloud.
    // User requested "Sync". So we probably want the latest. 
    // Let's standard: Try Local, but maybe we should have a 'sync' method.
    // For now, simple fallback.

    let workflow = await dbLocal.get(WORKFLOWS_STORE, id);

    if (workflow) return workflow;

    const user = { uid: CURRENT_USER_ID };
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

export async function getAllWorkflowsFromStorage(): Promise<Workflow[]> {
    const dbLocal = await initDB();

    // 1. Get Local
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    // 2. Merge with Cloud if logged in
    const user = { uid: CURRENT_USER_ID };
    if (user) {
        try {
            const collectionRef = collection(db, 'users', user.uid, 'workflows');
            const snap = await getDocs(collectionRef);

            const cloudWorkflows = snap.docs.map(d => d.data());

            // Simple merge: Cloud wins if exists, else keep local (if local has ones not in cloud)
            // Or just update local with cloud items
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
    const user = { uid: CURRENT_USER_ID };
    if (!user) return;

    const dbLocal = await initDB();
    const localWorkflows = await dbLocal.getAll(WORKFLOWS_STORE);

    // Naive Sync: Push all local workflows that aren't marked as 'synced' (or just all of them, relying on merge)
    // For efficiency, we should track a 'synced' flag locally.
    // For now, let's just push everything to ensure cloud has latest.

    console.log(`Syncing ${localWorkflows.length} workflows to cloud...`);

    const batchPromises = localWorkflows.map(async (wf) => {
        try {
            const docRef = doc(db, 'users', user.uid, 'workflows', wf.id);
            // We use setDoc with merge to update cloud 
            await setDoc(docRef, { ...wf, synced: true }, { merge: true });
        } catch (e) {
            console.warn(`Failed to sync workflow ${wf.id}`, e);
        }
    });

    await Promise.all(batchPromises);
    console.log("Workflow sync complete.");
}
