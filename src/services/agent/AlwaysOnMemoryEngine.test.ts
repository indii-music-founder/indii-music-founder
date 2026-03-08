import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';
import { MemorySummarizer } from './memory/MemorySummarizer';

// ============================================================================
// MOCKS — vi.hoisted ensures these are available before vi.mock hoisting
// ============================================================================

const mocks = vi.hoisted(() => ({
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue('mock-id'),
    update: vi.fn().mockResolvedValue(undefined),
    deleteFn: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    generateText: vi.fn().mockResolvedValue('Mock generated text answer'),
    embedContent: vi.fn().mockResolvedValue({ values: [0.1, 0.2, 0.3] }),
    generateInsight: vi.fn().mockResolvedValue({
        insight: 'Mock Insight',
        summary: 'Mock Summary',
        confidence: 0.85,
        sourceMemoryIds: ['1', '2'],
        connections: [],
        createdAt: { toMillis: () => Date.now() },
    }),
}));

vi.mock('../FirestoreService', () => ({
    FirestoreService: class MockFirestoreService {
        constructor() { }
        list = mocks.list;
        add = mocks.add;
        update = mocks.update;
        delete = mocks.deleteFn;
        get = mocks.get;
        query = vi.fn().mockResolvedValue([]);
    },
}));

vi.mock('../ai/FirebaseAIService', () => ({
    FirebaseAIService: {
        getInstance: vi.fn().mockReturnValue({
            embedContent: mocks.embedContent,
            generateText: mocks.generateText,
            batchEmbedContents: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
        }),
    },
}));

vi.mock('./memory/MemorySummarizer', () => ({
    MemorySummarizer: {
        extractEntities: vi.fn().mockResolvedValue([{ name: 'MockEntity', type: 'Concept' }]),
        assignTopics: vi.fn().mockResolvedValue(['MockTopic']),
        scoreImportance: vi.fn().mockResolvedValue(0.8),
        generateInsight: mocks.generateInsight,
    },
}));

vi.mock('./memory/MemorySearch', () => ({
    MemorySearch: {
        semanticSearch: vi.fn().mockResolvedValue([]),
    },
}));

// Mock RequestBatcher to resolve immediately (avoids timer-based batching)
vi.mock('@/utils/RequestBatcher', () => ({
    RequestBatcher: class {
        private fn: (items: string[]) => Promise<number[][]>;
        constructor(fn: (items: string[]) => Promise<number[][]>) {
            this.fn = fn;
        }
        async add(item: string): Promise<number[]> {
            const results = await this.fn([item]);
            return results[0] || [];
        }
    },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createMockMemory(overrides: Record<string, unknown> = {}) {
    return {
        id: 'mem-1',
        userId: 'test-user-id',
        content: 'Test memory content',
        summary: 'Test summary',
        rawText: 'Raw text of the memory',
        category: 'fact' as const,
        tier: 'shortTerm' as const,
        entities: [{ name: 'TestEntity', type: 'Concept' }],
        topics: ['testing'],
        importance: 0.7,
        source: 'user_input',
        createdAt: { toMillis: () => Date.now() - 3600000 },
        updatedAt: { toMillis: () => Date.now() },
        lastAccessedAt: { toMillis: () => Date.now() - 3600000 },
        accessCount: 1,
        isActive: true,
        consolidated: false,
        connections: [],
        relatedMemoryIds: [],
        tags: ['testing'],
        ...overrides,
    };
}

// ============================================================================
// TESTS
// ============================================================================

describe('AlwaysOnMemoryEngine', () => {
    const userId = 'test-user-id';
    let engine: AlwaysOnMemoryEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-establish mock return values after clearAllMocks
        mocks.list.mockResolvedValue([]);
        mocks.add.mockResolvedValue('mock-id');
        mocks.update.mockResolvedValue(undefined);
        mocks.generateText.mockResolvedValue('Mock generated text answer');
        mocks.embedContent.mockResolvedValue({ values: [0.1, 0.2, 0.3] });
        mocks.generateInsight.mockResolvedValue({
            insight: 'Mock Insight',
            summary: 'Mock Summary',
            confidence: 0.85,
            sourceMemoryIds: ['1', '2'],
            connections: [],
            createdAt: { toMillis: () => Date.now() },
        });
        engine = new AlwaysOnMemoryEngine();
    });

    afterEach(() => {
        engine.stop();
    });

    it('should instantiate successfully', () => {
        expect(engine).toBeInstanceOf(AlwaysOnMemoryEngine);
    });

    // ─── Lifecycle ──────────────────────────────────────────

    describe('Lifecycle Methods', () => {
        it('should start and report isRunning = true', async () => {
            engine.start(userId);
            const status = await engine.getStatus(userId);
            expect(status.isRunning).toBe(true);
        });

        it('should stop and report isRunning = false', async () => {
            engine.start(userId);
            engine.stop();
            const status = await engine.getStatus(userId);
            expect(status.isRunning).toBe(false);
        });
    });

    // ─── Ingestion ──────────────────────────────────────────

    describe('ingestText', () => {
        it('should process text and store as memory', async () => {
            const memoryId = await engine.ingestText(userId, 'This is a test memory fact.');

            expect(MemorySummarizer.extractEntities).toHaveBeenCalledWith('This is a test memory fact.');
            expect(MemorySummarizer.assignTopics).toHaveBeenCalledWith('This is a test memory fact.');
            expect(memoryId).toBe('mock-id');
        });

        it('should reject empty text', async () => {
            const memoryId = await engine.ingestText(userId, '   ');
            expect(memoryId).toBe('');
        });

        it('should detect duplicates and return existing id', async () => {
            mocks.list.mockResolvedValueOnce([
                { id: 'existing-id', rawText: 'Duplicate text', isActive: true },
            ]);

            const memoryId = await engine.ingestText(userId, 'Duplicate text');
            expect(memoryId).toBe('existing-id');
            // add() called once for the ingestion event log, NOT for a new memory doc
            expect(mocks.add).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Query ──────────────────────────────────────────────

    describe('queryMemory', () => {
        it('should return early message when no memories exist', async () => {
            mocks.list.mockResolvedValue([]);
            const answer = await engine.queryMemory(userId, 'What is the test fact?');
            expect(answer).toContain("don't have any memories");
            expect(mocks.generateText).not.toHaveBeenCalled();
        });

        it('should generate an answer when memories exist', async () => {
            mocks.list
                .mockResolvedValueOnce([
                    createMockMemory({ id: 'mem-1', summary: 'Test fact about music' }),
                    createMockMemory({ id: 'mem-2', summary: 'Another fact' }),
                ])
                .mockResolvedValueOnce([]); // insights

            const answer = await engine.queryMemory(userId, 'What is the test fact?');

            expect(mocks.generateText).toHaveBeenCalled();
            expect(answer).toBe('Mock generated text answer');
        });
    });

    // ─── Consolidation ──────────────────────────────────────

    describe('runConsolidation', () => {
        it('should skip if insufficient unconsolidated memories', async () => {
            mocks.list.mockResolvedValueOnce([]);
            const insight = await engine.runConsolidation(userId);
            expect(insight).toBeNull();
            expect(mocks.generateInsight).not.toHaveBeenCalled();
        });

        it('should generate an insight when enough unconsolidated memories exist', async () => {
            mocks.list.mockResolvedValueOnce([
                createMockMemory({ id: 'mem-1', consolidated: false, isActive: true }),
                createMockMemory({ id: 'mem-2', consolidated: false, isActive: true }),
                createMockMemory({ id: 'mem-3', consolidated: false, isActive: true }),
            ]);

            const insight = await engine.runConsolidation(userId);

            expect(mocks.generateInsight).toHaveBeenCalled();
            if (insight) {
                expect(insight.summary).toBe('Mock Summary');
            }
        });
    });

    // ─── Status ─────────────────────────────────────────────

    describe('getStatus', () => {
        it('should return correct initial stats', async () => {
            const status = await engine.getStatus(userId);
            expect(status).toHaveProperty('isRunning');
            expect(status).toHaveProperty('totalMemories');
            expect(status.totalMemories).toBe(0);
            expect(status.unconsolidatedCount).toBe(0);
            expect(status.totalInsights).toBe(0);
        });

        it('should reflect running state after start', async () => {
            engine.start(userId);
            const status = await engine.getStatus(userId);
            expect(status.isRunning).toBe(true);
        });

        it('should return correct counts with memories', async () => {
            mocks.list.mockResolvedValue([
                createMockMemory({ id: 'mem-1', consolidated: false, tier: 'shortTerm' }),
                createMockMemory({ id: 'mem-2', consolidated: true, tier: 'longTerm' }),
            ]);

            const status = await engine.getStatus(userId);
            expect(status.totalMemories).toBe(2);
            expect(status.unconsolidatedCount).toBe(1);
        });
    });

    // ─── Clear All ──────────────────────────────────────────

    describe('clearAll', () => {
        it('should delete all data and return counts', async () => {
            mocks.list
                .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // memories
                .mockResolvedValueOnce([{ id: 'i1' }])              // insights
                .mockResolvedValueOnce([{ id: 'e1' }]);             // events

            const result = await engine.clearAll(userId);
            expect(result.memoriesDeleted).toBe(2);
            expect(result.insightsDeleted).toBe(1);
        });
    });
});
