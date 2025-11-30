
// ... existing imports
import { UploadedImage, HistoryItem, SavedPrompt, Project, CanvasImage, UploadedAudio, AgentMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'indiiOS_DB';
const DB_VERSION = 3;

export const DB_STORES = {
    IMAGES: 'images',
    HISTORY: 'history',
    PROMPTS: 'prompts',
    SETTINGS: 'settings',
    CANVAS: 'canvas',
    AGENT_MEMORY: 'agent_memory'
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORES.IMAGES)) {
                db.createObjectStore(DB_STORES.IMAGES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_STORES.HISTORY)) {
                db.createObjectStore(DB_STORES.HISTORY, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_STORES.PROMPTS)) {
                db.createObjectStore(DB_STORES.PROMPTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_STORES.SETTINGS)) {
                db.createObjectStore(DB_STORES.SETTINGS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(DB_STORES.CANVAS)) {
                db.createObjectStore(DB_STORES.CANVAS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_STORES.AGENT_MEMORY)) {
                const store = db.createObjectStore(DB_STORES.AGENT_MEMORY, { keyPath: 'id' });
                store.createIndex('projectId', 'projectId', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });

    return dbPromise;
}

// ... existing generic helpers ...

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await initDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

export async function getAll<T>(storeName: string): Promise<T[]> {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveItem<T>(storeName: string, item: T): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function deleteItem(storeName: string, key: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function clearStore(storeName: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ... existing specific accessors (saveImage, etc) ...

export async function saveImage(img: UploadedImage) { await saveItem(DB_STORES.IMAGES, img); }
export async function deleteImage(id: string) { await deleteItem(DB_STORES.IMAGES, id); }
export async function saveHistoryItem(item: HistoryItem) { await saveItem(DB_STORES.HISTORY, item); }
export async function deleteHistoryItem(id: string) { await deleteItem(DB_STORES.HISTORY, id); }
export async function savePrompt(prompt: SavedPrompt) { await saveItem(DB_STORES.PROMPTS, prompt); }
export async function deletePrompt(id: string) { await deleteItem(DB_STORES.PROMPTS, id); }
export async function saveCanvasImage(img: CanvasImage) { await saveItem(DB_STORES.CANVAS, img); }
export async function deleteCanvasImage(id: string) { await deleteItem(DB_STORES.CANVAS, id); }
export async function saveSettings(key: string, value: any) { await saveItem(DB_STORES.SETTINGS, { key, value }); }
export async function getSettings(key: string): Promise<any> {
    const store = await getStore(DB_STORES.SETTINGS);
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => reject(request.error);
    });
}
export async function saveAgentMessage(msg: AgentMessage) { await saveItem(DB_STORES.AGENT_MEMORY, msg); }
export async function getProjectAgentMemory(projectId: string): Promise<AgentMessage[]> {
    const store = await getStore(DB_STORES.AGENT_MEMORY);
    const index = store.index('projectId');
    return new Promise((resolve, reject) => {
        const request = index.getAll(projectId);
        request.onsuccess = () => {
            const msgs = request.result as AgentMessage[];
            msgs.sort((a, b) => a.timestamp - b.timestamp);
            resolve(msgs);
        };
        request.onerror = () => reject(request.error);
    });
}
export async function clearProjectAgentMemory(projectId: string) {
    const db = await initDB();
    const tx = db.transaction(DB_STORES.AGENT_MEMORY, 'readwrite');
    const store = tx.objectStore(DB_STORES.AGENT_MEMORY);
    const index = store.index('projectId');
    const request = index.openCursor(IDBKeyRange.only(projectId));
    request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };
}

export async function deleteProjectData(projectId: string): Promise<void> {
    const storesToDeleteFrom = [
        DB_STORES.IMAGES,
        DB_STORES.HISTORY,
        DB_STORES.PROMPTS,
        DB_STORES.CANVAS
    ];

    for (const storeName of storesToDeleteFrom) {
        const store = await getStore(storeName, 'readwrite');
        // Since we don't have indices on projectId for these stores yet,
        // we have to iterate through all records.
        // See SCHEMA_UPGRADE_NOTES.md
        const request = store.openCursor();

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
                if (cursor) {
                    const record = cursor.value;
                    if (record.projectId === projectId) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Agent memory has an index, so we use the optimized delete helper
    await clearProjectAgentMemory(projectId);
}

// --- NEW HELPER FOR DASHBOARD ---
export async function getProjectMetadata(projectId: string) {
    const [images, history] = await Promise.all([
        getAll<UploadedImage>(DB_STORES.IMAGES),
        getAll<HistoryItem>(DB_STORES.HISTORY)
    ]);

    // Filter by Project ID
    const projImages = images.filter(i => i.projectId === projectId);
    const projHistory = history.filter(h => h.projectId === projectId);
    const videos = projHistory.filter(h => h.type === 'video');

    // Get thumbnail (prefer recent history, else recent upload)
    let thumbnail = null;
    if (projHistory.length > 0) thumbnail = projHistory[0].base64;
    else if (projImages.length > 0) thumbnail = projImages[0].base64;

    // If video, extract frame (simplified, might be raw data URI)
    if (thumbnail && thumbnail.startsWith('data:video')) {
        // Thumbnail generation for video is async/complex, skipping here for speed
        // Or assume history items are images unless type video, but history base64 is dataURI
        // If history item is video, the base64 is usually the video file. 
        // We might need to store a separate thumbnail. For now, fallback to generic icon if video.
        thumbnail = null;
    }

    return {
        imageCount: projImages.length + projHistory.filter(h => h.type === 'image').length,
        videoCount: videos.length,
        thumbnail
    };
}

export async function loadAllData(projectId: string) {
    const [images, history, prompts, projectsWrap, currentProjectWrap, canvasImages, audio, showroomAsset, agentMessages] = await Promise.all([
        getAll<UploadedImage>(DB_STORES.IMAGES),
        getAll<HistoryItem>(DB_STORES.HISTORY),
        getAll<SavedPrompt>(DB_STORES.PROMPTS),
        getSettings('projects'),
        getSettings('currentProjectId'),
        getAll<CanvasImage>(DB_STORES.CANVAS),
        getSettings('uploadedAudio'),
        getSettings('showroomAsset'),
        getProjectAgentMemory(projectId || 'default')
    ]);

    history.sort((a, b) => b.timestamp - a.timestamp);
    prompts.sort((a, b) => b.date - a.date);

    const safeProjectId = projectId || (currentProjectWrap || 'default');

    const filteredImages = images.filter(i => i.projectId === safeProjectId);
    const filteredHistory = history.filter(h => h.projectId === safeProjectId);
    const filteredCanvas = canvasImages.filter(c => c.projectId === safeProjectId);

    return {
        images: filteredImages,
        history: filteredHistory,
        prompts: prompts,
        projects: projectsWrap || [{ id: 'default', name: 'Default Project', context: '' }],
        currentProjectId: currentProjectWrap || 'default',
        canvasImages: filteredCanvas,
        audio: audio as UploadedAudio | null,
        showroomAsset: showroomAsset as { base64: string, mimeType: string } | null,
        agentHistory: agentMessages || []
    };
}
