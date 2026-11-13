// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
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
        const createdAt = Timestamp.fromMillis(1_700_000_000_000);
        const insight: Omit<ConsolidationInsight, 'id'> = {
            userId,
            insight: 'Two related preferences',
            summary: 'Two related preferences',
            sourceMemoryIds: ids,
            confidence: 0.9,
            createdAt,
            connections: [{
                fromMemoryId: 'first',
                toMemoryId: 'second',
                relationship: 'related',
                confidence: 0.9,
                discoveredAt: createdAt,
            }],
        };
        const outcomes = await Promise.all([
            MemoryConsolidator['commitInsightGroup'](userId, ids, insight),
            MemoryConsolidator['commitInsightGroup'](userId, ids, insight),
        ]);
        expect(outcomes.sort()).toEqual([false, true]);
        const insights = await getDocs(collection(db, 'users', userId, 'consolidationInsights'));
        expect(insights.size).toBe(1);
        expect(insights.docs[0]?.data().sourceMemoryIds).toEqual(ids);
        const saved = insights.docs[0]?.data();
        expect(saved?.createdAt).toBeInstanceOf(Timestamp);
        expect(saved?.createdAt.toMillis()).toBe(createdAt.toMillis());
        expect(saved?.connections[0].discoveredAt).toBeInstanceOf(Timestamp);
        const memories = await getDocs(memoryPath);
        expect(memories.docs.map(memory => memory.data().consolidated)).toEqual([true, true]);
    } finally {
        await environment.cleanup();
    }
}, 30_000);
