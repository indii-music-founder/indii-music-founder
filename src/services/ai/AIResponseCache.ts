import { openDB, IDBPDatabase } from 'idb';
import { createHash } from 'crypto';

interface CachedResponse {
    key: string;
    response: string;
    timestamp: number;
    model: string;
    expiresAt: number;
}

/**
 * Mock database interface for server-side/test environments
 * where IndexedDB is not available.
 */
interface MockDatabase {
    get: (storeName: string, key: string) => Promise<CachedResponse | null>;
    put: (storeName: string, value: CachedResponse) => Promise<void>;
    delete: (storeName: string, key: string) => Promise<void>;
    clear: (storeName: string) => Promise<void>;
}

const DB_NAME = 'indiiOS-AI-Cache';
const STORE_NAME = 'responses';
const DEFAULT_TTL = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Creates a no-op mock database for server-side/test environments.
 * All methods resolve successfully with null/void to avoid breaking code paths.
 */
function createMockDatabase(): MockDatabase {
    return {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
        clear: async () => {}
    };
}

export class AIResponseCache {
    private dbPromise: Promise<IDBPDatabase | MockDatabase>;

    constructor() {
        if (typeof window !== 'undefined') {
            this.dbPromise = openDB(DB_NAME, 1, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                },
            });
        } else {
            // No-op for server-side/test envs
            this.dbPromise = Promise.resolve(createMockDatabase());
        }
    }

    private async getHash(input: string): Promise<string> {
        // Simple hash for browser keys
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    async get(prompt: string, model: string, config?: any): Promise<string | null> {
        if (typeof window === 'undefined') return null;

        try {
            const key = await this.generateKey(prompt, model, config);
            const db = await this.dbPromise;
            const entry: CachedResponse = await db.get(STORE_NAME, key);

            if (!entry) return null;

            if (Date.now() > entry.expiresAt) {
                await db.delete(STORE_NAME, key);
                return null;
            }

            return entry.response;
        } catch {
            return null;
        }
    }

    async set(prompt: string, response: string, model: string, config?: any, ttl: number = DEFAULT_TTL): Promise<void> {
        if (typeof window === 'undefined') return;

        try {
            const key = await this.generateKey(prompt, model, config);
            const db = await this.dbPromise;

            await db.put(STORE_NAME, {
                key,
                response,
                model,
                timestamp: Date.now(),
                expiresAt: Date.now() + ttl
            });
        } catch {
            // Silent failure - cache is optional
        }
    }

    private async generateKey(prompt: string, model: string, config?: any): Promise<string> {
        const configStr = config ? JSON.stringify(config) : '';
        const raw = `${model}:${prompt}:${configStr}`;
        return this.getHash(raw);
    }

    async clear(): Promise<void> {
        if (typeof window === 'undefined') return;
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
    }
}

export const aiCache = new AIResponseCache();
