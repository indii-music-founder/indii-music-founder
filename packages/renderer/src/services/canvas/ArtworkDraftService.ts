import type { CanvasDoc } from './CanvasDoc';
import { normalizeCanvasDoc } from './CanvasDocValidation';

interface Draft { key: string; uid: string; document: CanvasDoc }
let database: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
    if (!database) database = new Promise((resolve, reject) => {
        const request = indexedDB.open('indii-artwork-drafts', 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
        request.onsuccess = () => {
            if (blocked) { request.result.close(); return; }
            request.result.onversionchange = () => { request.result.close(); database = null; };
            resolve(request.result);
        };
        request.onblocked = () => { blocked = true; database = null; reject(new Error('Close other editor tabs to enable local artwork recovery')); };
        request.onerror = () => { database = null; reject(request.error ?? new Error('Local artwork recovery unavailable')); };
    });
    return database;
}
function key(uid: string, document: CanvasDoc): string { return JSON.stringify([uid, document.projectId, document.id]); }

export const ArtworkDraftService = {
    async save(uid: string, document: CanvasDoc): Promise<void> {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('drafts', 'readwrite');
            const store = tx.objectStore('drafts');
            const draftKey = key(uid, document);
            const lookup = store.get(draftKey);
            lookup.onsuccess = () => {
                const existing = lookup.result as Draft | undefined;
                if (existing && existing.document.updatedAt > document.updatedAt) {
                    tx.abort();
                    reject(new Error('A newer local draft exists. Save this artwork as a copy to preserve both.'));
                    return;
                }
                store.put({ key: draftKey, uid, document });
                const list = store.getAll();
                list.onsuccess = () => {
                    const drafts = (list.result as Draft[]).filter(d => d.uid === uid).sort((a, b) => b.document.updatedAt - a.document.updatedAt);
                    for (const old of drafts.slice(30)) store.delete(old.key);
                };
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('Local recovery could not save this artwork'));
            tx.onabort = tx.onerror;
        });
    },
    async list(uid: string, projectId: string): Promise<CanvasDoc[]> {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
            request.onsuccess = () => {
                try {
                    resolve((request.result as Draft[]).filter(d => d.uid === uid && d.document.projectId === projectId)
                        .map(d => normalizeCanvasDoc(d.document)).sort((a, b) => b.updatedAt - a.updatedAt));
                } catch (error) { reject(error); }
            };
            request.onerror = () => reject(request.error);
        });
    },
    async discard(uid: string, document: CanvasDoc): Promise<void> {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('drafts', 'readwrite');
            tx.objectStore('drafts').delete(key(uid, document));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
};
