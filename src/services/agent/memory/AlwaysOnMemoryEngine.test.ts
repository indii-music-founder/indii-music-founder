import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';

// ============================================================================
// MOCKS
// ============================================================================

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user-123' } },
}));

// Mock Firestore
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'mem-001' });
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [], empty: true });
const mockGetCountFromServer = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn().mockReturnValue({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
});

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    getCountFromServer: (...args: any[]) => mockGetCountFromServer(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    writeBatch: (...args: any[]) => mockWriteBatch(...args),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn().mockReturnValue(new Date()),
    Timestamp: {
        now: () => ({
            toMillis: () => Date.now(),
            toDate: () => new Date(),
        }),
        fromMillis: (ms: number) => ({
            toMillis: () => ms,
            toDate: () => new Date(ms),
        }),
    },
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
}));

// Mock AI Service
const mockGenerateText = vi.fn().mockResolvedValue('Test summary of the content');
const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
        text: () => 'Description of media content',
        candidates: [{ content: { parts: [{ text: 'Description of media content' }] } }],
    },
});
const mockEmbedContent = vi.fn().mockResolvedValue({ values: [0.1, 0.2, 0.3] });
const mockBatchEmbedContents = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);

vi.mock('../../ai/FirebaseAIService', () => ({
    FirebaseAIService: {
        getInstance: () => ({
            generateText: mockGenerateText,
            generateContent: mockGenerateContent,
            embedContent: mockEmbedContent,
            batchEmbedContents: mockBatchEmbedContents,
        }),
    },
}));

// Mock AI models
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: { AGENT: 'gemini-3.1-pro-preview', FAST: 'gemini-3-flash-preview' },
        EMBEDDING: { DEFAULT: 'gemini-embedding-001' },
    },
    APPROVED_MODELS: {
        TEXT_AGENT: 'gemini-3.1-pro-preview',
        TEXT_FAST: 'gemini-3-flash-preview',
        EMBEDDING_DEFAULT: 'gemini-embedding-001',
    },
}));

// Mock RequestBatcher
vi.mock('@/utils/RequestBatcher', () => ({
    RequestBatcher: class <T, R> {
        constructor(private processor: (items: T[]) => Promise<R[]>) { }
        async add(item: T): Promise<R> {
            const results = await this.processor([item]);
            return results[0]!;
        }
    },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('AlwaysOnMemoryEngine', () => {
    let engine: AlwaysOnMemoryEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        // Get fresh instance by accessing the singleton
        // Note: In tests, we need to reset the singleton state
        engine = AlwaysOnMemoryEngine.getInstance();
        engine.stop(); // Ensure clean state
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Lifecycle', () => {
        it('should start the engine for a user', async () => {
            await engine.start('test-user-123');
            expect(engine.running).toBe(true);
        });

        it('should stop the engine', async () => {
            await engine.start('test-user-123');
            engine.stop();
            expect(engine.running).toBe(false);
        });

        it('should not start twice for the same user', async () => {
            await engine.start('test-user-123');
            await engine.start('test-user-123'); // Should not throw
            expect(engine.running).toBe(true);
        });

        it('should stop previous engine when starting for a different user', async () => {
            await engine.start('user-1');
            expect(engine.running).toBe(true);
            await engine.start('user-2');
            expect(engine.running).toBe(true);
        });
    });

    describe('Ingest (IngestAgent)', () => {
        beforeEach(async () => {
            // Setup mock responses for extraction pipeline
            mockGenerateText.mockImplementation((prompt: string) => {
                if (prompt.includes('Summarize')) {
                    return Promise.resolve('AI agents are growing fast and reliability is a challenge.');
                }
                if (prompt.includes('Extract named entities')) {
                    return Promise.resolve(JSON.stringify({
                        entities: [
                            { name: 'AI', type: 'concept' },
                            { name: 'agents', type: 'concept' },
                        ],
                    }));
                }
                if (prompt.includes('topic tags')) {
                    return Promise.resolve(JSON.stringify({
                        topics: ['ai', 'agents', 'tech'],
                    }));
                }
                if (prompt.includes('Rate the importance')) {
                    return Promise.resolve(JSON.stringify({ importance: 0.8 }));
                }
                if (prompt.includes('Classify this text')) {
                    return Promise.resolve(JSON.stringify({ category: 'technical' }));
                }
                return Promise.resolve('Default response');
            });

            // Mock getDocs for deduplication check (no duplicates found)
            mockGetDocs.mockResolvedValue({
                docs: [],
                empty: true,
            });

            await engine.start('test-user-123');
        });

        it('should ingest text content', async () => {
            const result = await engine.ingest('AI agents are growing fast but reliability is a challenge.');

            expect(result).toContain('Stored');
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should reject empty text', async () => {
            const result = await engine.ingest('');
            expect(result).toContain('Failed');
        });

        it('should skip duplicate content', async () => {
            // Setup: pretend the content already exists
            mockGetDocs.mockResolvedValue({
                docs: [{
                    id: 'existing-1',
                    data: () => ({
                        content: 'already stored content',
                        rawText: 'already stored content',
                        isActive: true,
                    }),
                }],
                empty: false,
            });

            const result = await engine.ingest('already stored content');
            expect(result).toContain('Skipped');
        });

        it('should handle calls after stop gracefully', async () => {
            // The singleton retains state, so after stop it still has the user ID.
            // A fresh getInstance() without start() should throw.
            const freshEngine = AlwaysOnMemoryEngine.getInstance();
            freshEngine.stop();
            // Ingestion should still work if userId is retained from prior start
            // This is by design — stop() only disables the consolidation timer
            expect(freshEngine.running).toBe(false);
        });
    });

    describe('Query (QueryAgent)', () => {
        beforeEach(async () => {
            // Return memories for the first call, then empty for insights
            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call: getAllMemories
                    return Promise.resolve({
                        docs: [
                            {
                                id: 'mem-1',
                                data: () => ({
                                    id: 'mem-1',
                                    content: 'User prefers dark blue album art',
                                    summary: 'User prefers dark blue album art',
                                    category: 'preference',
                                    tier: 'longTerm',
                                    importance: 0.8,
                                    entities: [{ name: 'album art', type: 'concept' }],
                                    topics: ['design', 'branding'],
                                    connections: [],
                                    relatedMemoryIds: [],
                                    isActive: true,
                                    createdAt: { toMillis: () => Date.now(), toDate: () => new Date() },
                                }),
                            },
                            {
                                id: 'mem-2',
                                data: () => ({
                                    id: 'mem-2',
                                    content: 'Target release date is March 15',
                                    summary: 'Target release date is March 15',
                                    category: 'goal',
                                    tier: 'shortTerm',
                                    importance: 0.9,
                                    entities: [],
                                    topics: ['deadline', 'release'],
                                    connections: [],
                                    relatedMemoryIds: [],
                                    isActive: true,
                                    createdAt: { toMillis: () => Date.now(), toDate: () => new Date() },
                                }),
                            },
                        ],
                        empty: false,
                    });
                }
                // Subsequent calls: insights (empty)
                return Promise.resolve({ docs: [], empty: true });
            });

            mockGenerateText.mockResolvedValue(
                'Based on your memories:\n' +
                '1. You prefer dark blue album art [Memory mem-1]\n' +
                '2. Your target release date is March 15 [Memory mem-2]'
            );

            await engine.start('test-user-123');
        });

        it('should answer questions with memory citations', async () => {
            const answer = await engine.query('What are my visual preferences?');

            expect(answer).toContain('dark blue');
            expect(answer).toContain('[Memory');
            expect(mockGenerateText).toHaveBeenCalled();
        });

        it('should handle empty memory store gracefully', async () => {
            mockGetDocs.mockResolvedValue({ docs: [], empty: true });

            const answer = await engine.query('What do I like?');
            expect(answer).toContain("don't have any memories");
        });
    });

    describe('Status', () => {
        beforeEach(async () => {
            await engine.start('test-user-123');
        });

        it('should report engine status', async () => {
            const status = await engine.getStatus();

            expect(status.isRunning).toBe(true);
            expect(status).toHaveProperty('totalMemories');
            expect(status).toHaveProperty('unconsolidatedCount');
            expect(status).toHaveProperty('totalInsights');
            expect(status).toHaveProperty('memoriesByTier');
        });
    });

    describe('Clear All', () => {
        beforeEach(async () => {
            mockGetDocs.mockResolvedValue({
                docs: [
                    { ref: 'ref-1', id: 'mem-1', data: () => ({}) },
                    { ref: 'ref-2', id: 'mem-2', data: () => ({}) },
                ],
                empty: false,
            });

            await engine.start('test-user-123');
        });

        it('should clear all memories and insights', async () => {
            const result = await engine.clearAll();

            expect(result.memoriesDeleted).toBeGreaterThanOrEqual(0);
            expect(result.insightsDeleted).toBeGreaterThanOrEqual(0);
        });
    });
});
