
import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryItem {
    id: string;
    projectId: string;
    content: string;
    type: 'fact' | 'summary' | 'rule';
    timestamp: number;
    embedding?: number[];
}

const DB_NAME = 'indiiOS_DB';
const STORE_NAME = 'agent_memory';

class MemoryService {
    private dbPromise: Promise<IDBPDatabase>;

    constructor() {
        this.dbPromise = openDB(DB_NAME, 3, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId', { unique: false });
                }
            },
        });
    }

    async saveMemory(projectId: string, content: string, type: 'fact' | 'summary' | 'rule' = 'fact'): Promise<void> {
        const db = await this.dbPromise;

        // Check for duplicates (simple content match for now)
        // Ideally we'd use a vector similarity check here
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.store.index('projectId');
        let cursor = await index.openCursor(IDBKeyRange.only(projectId));

        while (cursor) {
            if (cursor.value.content === content) {
                return; // Duplicate found
            }
            cursor = await cursor.continue();
        }

        const item: MemoryItem = {
            id: uuidv4(),
            projectId,
            content,
            type,
            timestamp: Date.now()
        };

        await db.put(STORE_NAME, item);
    }

    async retrieveRelevantMemories(projectId: string, query: string, limit = 5): Promise<string[]> {
        const db = await this.dbPromise;
        const index = db.transaction(STORE_NAME, 'readonly').store.index('projectId');
        const memories = await index.getAll(projectId);

        // Simple keyword scoring since we don't have a vector DB yet
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);

        const scored = memories.map(m => {
            let score = 0;
            const content = m.content.toLowerCase();
            keywords.forEach(k => {
                if (content.includes(k)) score++;
            });
            // Boost 'rule' type memories as they are critical instructions
            if (m.type === 'rule') score += 0.5;

            return { content: m.content, score, timestamp: m.timestamp };
        });

        scored.sort((a, b) => b.score - a.score);

        // Filter out zero scores unless we have very few results
        const relevant = scored.filter(s => s.score > 0);

        // If no relevant memories found, return recent rules as fallback context
        if (relevant.length === 0) {
            return scored
                .filter(s => s.content.includes('rule') || s.content.includes('RULE')) // Fallback check
                .slice(0, 3)
                .map(s => s.content);
        }

        return relevant.slice(0, limit).map(s => s.content);
    }

    async clearProjectMemory(projectId: string): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const index = tx.store.index('projectId');
        let cursor = await index.openCursor(IDBKeyRange.only(projectId));

        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
    }
}

export const memoryService = new MemoryService();
