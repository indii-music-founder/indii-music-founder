import { openDB } from 'idb';

const DB_NAME = 'rndr-ai-db';
const STORE_NAME = 'assets';
const WORKFLOWS_STORE = 'workflows';

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

export async function saveAssetToStorage(blob: Blob): Promise<string> {
    const db = await initDB();
    const id = crypto.randomUUID();
    await db.put(STORE_NAME, blob, id);
    return id;
}

export async function getAssetFromStorage(id: string): Promise<string> {
    const db = await initDB();
    const blob = await db.get(STORE_NAME, id);
    if (!blob) throw new Error(`Asset ${id} not found`);
    return URL.createObjectURL(blob);
}

export async function saveWorkflowToStorage(workflow: any): Promise<void> {
    const db = await initDB();
    await db.put(WORKFLOWS_STORE, workflow);
}

export async function getWorkflowFromStorage(id: string): Promise<any> {
    const db = await initDB();
    return db.get(WORKFLOWS_STORE, id);
}

export async function getAllWorkflowsFromStorage(): Promise<any[]> {
    const db = await initDB();
    return db.getAll(WORKFLOWS_STORE);
}
