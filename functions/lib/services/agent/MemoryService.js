"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const idb_1 = require("idb");
class InMemoryStore {
    constructor() {
        this.store = new Map();
    }
    async get(key) { return this.store.get(key); }
    async set(key, value) { this.store.set(key, value); }
    async del(key) { this.store.delete(key); }
}
class MemoryService {
    constructor() {
        if (typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB) {
            this.dbPromise = (async () => {
                const db = await (0, idb_1.openDB)('rndr-memory', 1, {
                    upgrade(database) {
                        if (!database.objectStoreNames.contains('kv')) {
                            database.createObjectStore('kv');
                        }
                    },
                });
                return {
                    get: (k) => db.get('kv', k),
                    set: async (k, v) => { await db.put('kv', v, k); },
                    del: async (k) => { await db.delete('kv', k); },
                };
            })();
        }
        else {
            const mem = new InMemoryStore();
            this.dbPromise = Promise.resolve({
                get: (k) => Promise.resolve(mem.get(k)),
                set: (k, v) => Promise.resolve(mem.set(k, v)),
                del: (k) => Promise.resolve(mem.del(k)),
            });
        }
    }
    async get(key) {
        const db = await this.dbPromise;
        return db.get(key);
    }
    async set(key, value) {
        const db = await this.dbPromise;
        return db.set(key, value);
    }
    async delete(key) {
        const db = await this.dbPromise;
        return db.del(key);
    }
}
exports.default = MemoryService;
//# sourceMappingURL=MemoryService.js.map