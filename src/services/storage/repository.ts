import { openDB } from 'idb';

const DB_NAME = 'rndr-ai-db';
const STORE_NAME = 'assets';

export async function initDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
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
