// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { expect, it, vi } from 'vitest';
import type { ConsolidationInsight } from '@/types/AlwaysOnMemory';
import { MemoryConsolidator } from './MemoryConsolidator';

const firebase = vi.hoisted(() => ({ db: undefined as Firestore | undefined }));
vi.mock('../../firebase', () => firebase);
vi.mock('./MemorySummarizer', () => ({ MemorySummarizer: {} }));

it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('commits one insight when concurrent workers process the same group', async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const environment = await initializeTestEnvironment({
        projectId: 'demo-memory-insights',
        firestore: {
            host,
            port: Number(port),
            rules: readFileSync('packages/firebase/firestore.rules', 'utf8'),
        },
    });
    try {
        const userId = 'memory-owner';
        const db = environment.authenticatedContext(userId).firestore() as unknown as Firestore;
        firebase.db = db;
        const memoryPath = collection(db, 'users', userId, 'alwaysOnMemories');
        const ids = ['first', 'second'];
        await Promise.all(ids.map(id => setDoc(doc(memoryPath, id), { isActive: true, consolidated: false })));
        const insight = { insight: 'Two related preferences', sourceMemoryIds: ids, connections: [] } as Omit<ConsolidationInsight, 'id'>;
        const outcomes = await Promise.all([
            MemoryConsolidator['commitInsightGroup'](userId, ids, insight),
            MemoryConsolidator['commitInsightGroup'](userId, ids, insight),
        ]);
        expect(outcomes.sort()).toEqual([false, true]);
        const insights = await getDocs(collection(db, 'users', userId, 'consolidationInsights'));
        expect(insights.size).toBe(1);
        expect(insights.docs[0]?.data().sourceMemoryIds).toEqual(ids);
        const memories = await getDocs(memoryPath);
        expect(memories.docs.map(memory => memory.data().consolidated)).toEqual([true, true]);
    } finally {
        await environment.cleanup();
    }
}, 30_000);
