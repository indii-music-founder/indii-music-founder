/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFirestoreDocs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const mockAddMemoryBank = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'mem0-1', memory: 'saved' }]));
const mockSearchMemoriesScoped = vi.hoisted(() => vi.fn().mockResolvedValue({
    results: [{ id: 'mem0-global-1', memory: 'Global preference: 24-bit WAV masters' }],
    hasMore: false,
    scopeMessage: 'Searched first page',
}));
const mockSearchMemories = vi.hoisted(() => vi.fn().mockResolvedValue({
    results: [{ id: 'mem0-rule-1', memory: 'Always keep album visuals minimal' }],
    hasMore: false,
}));
const mockVaultAddFact = vi.hoisted(() => vi.fn().mockResolvedValue('vault-fact-1'));
const mockVaultRead = vi.hoisted(() => vi.fn().mockResolvedValue({
    summary: 'Identity',
    facts: [{ id: 'f1', fact: 'Artist: Nova', category: 'artist_identity', status: 'active', accessCount: 1 }],
}));

vi.mock('@/services/firebase', () => ({ db: {} }));

vi.mock('@/utils/e2eMode', () => ({
    isFirebaseE2EMockEnabled: () => false,
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => ({
    FirebaseIntelligenceService: {
        getInstance: () => ({
            generateText: vi.fn().mockResolvedValue('{"category":"creative"}'),
        }),
    },
}));

vi.mock('@/services/agent/memory/MemoryBankService', () => ({
    memoryBankService: {
        addMemory: mockAddMemoryBank,
        searchMemories: mockSearchMemories,
        searchMemoriesScoped: mockSearchMemoriesScoped,
    },
}));

vi.mock('@/services/agent/memory/CoreVaultService', () => ({
    coreVaultService: {
        readVault: mockVaultRead,
        addFact: mockVaultAddFact,
    },
    ALL_VAULT_CATEGORIES: ['artist_identity', 'creative', 'goals', 'preferences'],
}));

vi.mock('@/services/agent/MemorySummarizer', () => ({
    MemorySummarizer: {
        extractEntities: vi.fn().mockResolvedValue([]),
        assignTopics: vi.fn().mockResolvedValue(['visuals']),
        scoreImportance: vi.fn().mockResolvedValue(0.8),
    },
}));

vi.mock('@/services/agent/backendEmbeddings', () => ({
    backendEmbedTexts: vi.fn().mockResolvedValue([[0.1, 0.2]]),
}));

vi.mock('@/services/agent/CaptainsLogService', () => ({
    captainsLogService: {
        getTodaysSummary: vi.fn().mockResolvedValue('Daily log entry'),
    },
}));

vi.mock('firebase/firestore', () => {
    const Timestamp = {
        now: vi.fn(() => ({ toMillis: () => Date.now(), seconds: 1000, nanoseconds: 0 })),
    };
    return {
        Timestamp,
        serverTimestamp: vi.fn(() => Timestamp.now()),
        collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
        doc: vi.fn((_db: unknown, ...segments: string[]) => ({
            path: segments.join('/'),
            id: segments[segments.length - 1],
        })),
        query: vi.fn((
            ref: { path?: string; constraints?: Array<{ type?: string; field?: string; value?: unknown }> },
            ...constraints: Array<{ type?: string; field?: string; value?: unknown }>
        ) => ({
            path: ref.path,
            constraints: [...(ref.constraints ?? []), ...constraints],
        })),
        where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
        orderBy: vi.fn((field: string, dir: string) => ({ type: 'orderBy', field, dir })),
        limit: vi.fn((n: number) => ({ type: 'limit', value: n })),
        addDoc: vi.fn(async (collRef: { path: string }, data: Record<string, unknown>) => {
            if (collRef.path.endsWith('alwaysOnMemories')) {
                const id = `mem-${mockFirestoreDocs.size + 1}`;
                mockFirestoreDocs.set(id, { ...data });
                return { id };
            }
            return { id: `evt-${Date.now()}` };
        }),
        getDoc: vi.fn(async (docRef: { id: string }) => {
            const data = mockFirestoreDocs.get(docRef.id);
            return {
                exists: () => Boolean(data),
                id: docRef.id,
                data: () => data,
            };
        }),
        getDocs: vi.fn(async (q: { path?: string; constraints?: Array<{ type?: string; field?: string; value?: unknown }> }) => {
            const path = q?.path ?? '';
            if (!path.endsWith('alwaysOnMemories')) {
                return { empty: true, docs: [] };
            }
            let entries = [...mockFirestoreDocs.entries()].map(([id, data]) => ({ id, data: () => data }));
            for (const c of q.constraints ?? []) {
                if (c.type === 'where' && c.field === 'sourceSessionId') {
                    entries = entries.filter(e => e.data().sourceSessionId === c.value);
                }
                if (c.type === 'where' && c.field === 'isActive') {
                    entries = entries.filter(e => e.data().isActive === c.value);
                }
            }
            return { empty: entries.length === 0, docs: entries };
        }),
        getDocsFromServer: vi.fn(async () => ({ empty: true, docs: [] })),
        updateDoc: vi.fn(async (docRef: { id: string }, updates: Record<string, unknown>) => {
            const existing = mockFirestoreDocs.get(docRef.id);
            if (existing) {
                mockFirestoreDocs.set(docRef.id, { ...existing, ...updates });
            }
        }),
        deleteDoc: vi.fn(async (docRef: { id: string }) => {
            mockFirestoreDocs.delete(docRef.id);
        }),
        writeBatch: vi.fn(() => ({ delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
        getCountFromServer: vi.fn(async () => ({ data: () => ({ count: mockFirestoreDocs.size }) })),
    };
});

import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { bigBrainEngine } from '@/services/agent/memory/BigBrainEngine';

describe('Meeting Room two-tier memory isolation & promotion', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockFirestoreDocs.clear();
        alwaysOnMemoryEngine.stop();
        await alwaysOnMemoryEngine.start('user-1');
    });

    it('keeps room-scoped memories out of global Mem0 and global BigBrain recall until promoted', async () => {
        const receipt = await alwaysOnMemoryEngine.addRoomMemory(
            'room-alpha',
            'proj-1',
            'Experimental neon-brutalist cover concept for Track 3',
            'creative'
        );
        expect(receipt.status).toBe('stored');
        if (receipt.status !== 'stored') return;

        // Room memory MUST NOT sync to global Mem0 on creation
        expect(mockAddMemoryBank).not.toHaveBeenCalled();

        // Stored doc carries room scope + sourceSessionId
        const savedDoc = mockFirestoreDocs.get(receipt.memoryId);
        expect(savedDoc?.memoryScope).toBe('room');
        expect(savedDoc?.sourceSessionId).toBe('room-alpha');
        expect(savedDoc?.promotedToGlobal).toBe(false);

        // Global BigBrain context excludes unpromoted room-alpha memory
        const globalCtx = await bigBrainEngine.assembleContext('user-1', 'creative', 'cover concept');
        expect(globalCtx.episodicRecall).not.toContain('neon-brutalist');
        expect(globalCtx.roomMemory).toBe('');

        // Room-A BigBrain context injects <room_memory> for room-alpha
        const roomCtx = await bigBrainEngine.assembleContext('user-1', 'creative', 'cover concept', 'proj-1', {
            roomSessionId: 'room-alpha',
        });
        expect(roomCtx.roomMemory).toContain('neon-brutalist');
        const promptXml = bigBrainEngine.formatForPrompt(roomCtx);
        expect(promptXml).toContain('<room_memory>');
        expect(promptXml).toContain('neon-brutalist');

        // Another room (room-beta) does NOT see room-alpha's unpromoted experiment
        const otherRoomCtx = await bigBrainEngine.assembleContext('user-1', 'creative', 'cover concept', 'proj-1', {
            roomSessionId: 'room-beta',
        });
        expect(otherRoomCtx.roomMemory).toBe('');
        expect(otherRoomCtx.episodicRecall).not.toContain('neon-brutalist');

        // Unpromoted room memory must not suppress global ingestion of matching text
        const globalDupTest = await alwaysOnMemoryEngine.addRoomMemory(
            'room-gamma',
            'proj-1',
            'Global preference text before promotion',
            'creative'
        );
        expect(globalDupTest.status).toBe('stored');
        const globalIngestId = await alwaysOnMemoryEngine.ingest(
            'Global preference text before promotion',
            'user_input',
            'creative',
            { memoryScope: 'global', projectId: 'proj-1' }
        );
        expect(globalIngestId).toBeTruthy();

        // Promoting room memory flips scope to global, syncs Mem0, and writes CORE Vault when specified
        const promoted = await alwaysOnMemoryEngine.promoteRoomMemoryToGlobal(receipt.memoryId, {
            writeToVaultCategory: 'goals',
        });
        expect(promoted.promoted).toBe(true);
        expect(mockAddMemoryBank).toHaveBeenCalledWith(
            'user-1',
            expect.stringContaining('neon-brutalist')
        );
        expect(mockVaultAddFact).toHaveBeenCalledWith(
            'user-1',
            'goals',
            expect.stringContaining('neon-brutalist'),
            'agent',
            { tags: ['meeting_room_promotion'] }
        );

        // Re-promoting an already-promoted memory is idempotent and does not duplicate Mem0/Vault writes
        const mem0CallsBefore = mockAddMemoryBank.mock.calls.length;
        const vaultCallsBefore = mockVaultAddFact.mock.calls.length;
        const repromoted = await alwaysOnMemoryEngine.promoteRoomMemoryToGlobal(receipt.memoryId, {
            writeToVaultCategory: 'goals',
        });
        expect(repromoted.promoted).toBe(true);
        expect(mockAddMemoryBank.mock.calls.length).toBe(mem0CallsBefore);
        expect(mockVaultAddFact.mock.calls.length).toBe(vaultCallsBefore);

        // Now global BigBrain recall sees the promoted memory
        const postPromoteGlobalCtx = await bigBrainEngine.assembleContext('user-1', 'creative', 'cover concept');
        expect(postPromoteGlobalCtx.episodicRecall).toContain('neon-brutalist');
    });
});
