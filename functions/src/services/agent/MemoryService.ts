
import { openDB } from 'idb';

class InMemoryStore {
    private store = new Map<string, any>();
    async get(key: string) { return this.store.get(key); }
    async set(key: string, value: any) { this.store.set(key, value); }
    async del(key: string) { this.store.delete(key); }
}

type DBApi = {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    del(key: string): Promise<void>;
};

export default class MemoryService {
    private dbPromise: Promise<DBApi>;

    constructor() {
        if (typeof (globalThis as any).indexedDB !== 'undefined' && (globalThis as any).indexedDB) {
            this.dbPromise = (async () => {
                const db = await openDB('rndr-memory', 1, {
                    upgrade(database) {
                        if (!database.objectStoreNames.contains('kv')) {
                            database.createObjectStore('kv');
                        }
                    },
                });
                return {
                    get: (k: string) => db.get('kv', k),
                    set: async (k: string, v: any) => { await db.put('kv', v, k); },
                    del: async (k: string) => { await db.delete('kv', k); },
                };
            })();
        } else {
            const mem = new InMemoryStore();
            this.dbPromise = Promise.resolve({
                get: (k: string) => Promise.resolve(mem.get(k)),
                set: (k: string, v: any) => Promise.resolve(mem.set(k, v)),
                del: (k: string) => Promise.resolve(mem.del(k)),
            });
        }
    }

    async get(key: string) {
        const db = await this.dbPromise;
        return db.get(key);
    }

    async set(key: string, value: any) {
        const db = await this.dbPromise;
        return db.set(key, value);
    }

    async delete(key: string) {
        const db = await this.dbPromise;
        return db.del(key);
    }
}
