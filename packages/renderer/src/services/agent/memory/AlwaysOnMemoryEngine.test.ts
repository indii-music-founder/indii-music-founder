import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';
import { memoryIngestionPipeline } from './MemoryIngestionPipeline';

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

// Mock Intelligence Service
const { mockGenerateText, mockGenerateContent, mockEmbedContent, mockBatchEmbedContents } = vi.hoisted(() => {
    const mockGenerateText = vi.fn().mockResolvedValue('Test summary of the content');
    const mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
            text: () => 'Description of media content',
            candidates: [{ content: { parts: [{ text: 'Description of media content' }] } }],
        },
    });
    const mockEmbedContent = vi.fn().mockResolvedValue({ values: [0.1, 0.2, 0.3] });
    const mockBatchEmbedContents = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);
    return { mockGenerateText, mockGenerateContent, mockEmbedContent, mockBatchEmbedContents };
});

vi.mock('../../intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: mockGenerateText,
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue({ videoId: 'mock-video-id' }),
        generateContent: mockGenerateContent,
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} }),
        embedContent: mockEmbedContent,
        batchEmbedContents: mockBatchEmbedContents
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

// Mock Autonomous models
vi.mock('@/core/config/intelligence-models', () => ({
    INTELLIGENCE_MODELS: {
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

    it('exposes stored, skipped and unconfirmed pipeline receipts without parsing status text', async () => {
        await engine.start('test-user-123');
        const spy = vi.spyOn(memoryIngestionPipeline, 'ingestText');
        try {
            spy.mockResolvedValueOnce({ success: true, memoryId: 'saved-memory', summary: 'Artist preference' });
            expect(await engine.ingestWithReceipt('preference')).toEqual({ status: 'stored', memoryId: 'saved-memory', summary: 'Artist preference' });
            spy.mockResolvedValueOnce({ success: true, skipped: true, skipReason: 'duplicate' });
            expect(await engine.ingestWithReceipt('duplicate')).toEqual({ status: 'skipped', reason: 'duplicate' });
            spy.mockResolvedValueOnce({ success: false, error: 'private details' });
            expect(await engine.ingestWithReceipt('failed')).toMatchObject({ status: 'unconfirmed' });
            spy.mockResolvedValueOnce({ success: true });
            expect(await engine.ingestWithReceipt('missing id')).toMatchObject({ status: 'unconfirmed' });
        } finally { spy.mockRestore(); }
    });

    it('keeps ingestion status active until concurrent text and file writes have settled', async () => {
        await engine.start('test-user-123');
        let finishText!: (value: { success: boolean; memoryId: string }) => void;
        let finishFile!: (value: { success: boolean; memoryId: string }) => void;
        const textSpy = vi.spyOn(memoryIngestionPipeline, 'ingestText').mockImplementationOnce(() => new Promise(resolve => { finishText = resolve; }));
        const fileSpy = vi.spyOn(memoryIngestionPipeline, 'ingestFile').mockImplementationOnce(() => new Promise(resolve => { finishFile = resolve; }));
        try {
            const text = engine.ingestWithReceipt('Artist rule');
            const file = engine.ingestFile(new Uint8Array([1]), 'notes.txt', 'text/plain');
            finishText({ success: true, memoryId: 'text-memory' });
            await text;
            expect((await engine.getStatus()).isIngesting).toBe(true);
            finishFile({ success: true, memoryId: 'file-memory' });
            await file;
            expect((await engine.getStatus()).isIngesting).toBe(false);
        } finally { textSpy.mockRestore(); fileSpy.mockRestore(); }
    });

    it('does not acknowledge a memory to a new owner after an in-flight owner change', async () => {
        await engine.start('test-user-123');
        let complete!: (value: { success: boolean; memoryId: string }) => void;
        const spy = vi.spyOn(memoryIngestionPipeline, 'ingestText').mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        try {
            const pending = engine.ingestWithReceipt('old owner preference');
            await engine.start('another-owner');
            complete({ success: true, memoryId: 'old-owner-memory' });
            expect(await pending).toMatchObject({ status: 'unconfirmed' });
        } finally { spy.mockRestore(); }
    });

    it('does not report skipped feedback as a stored memory', async () => {
        await engine.start('test-user-123');
        const ingest = vi.spyOn(engine, 'ingest')
            .mockResolvedValueOnce('Skipped: duplicate')
            .mockResolvedValueOnce('📥 Stored: artist rule');

        await expect(engine.saveFeedback('test-user-123', 'Avoid sponsored posts', 'negative'))
            .rejects.toThrow('Feedback memory was not stored');
        await expect(engine.saveFeedback('test-user-123', 'Avoid sponsored posts', 'negative'))
            .resolves.toContain('Stored: artist rule');
        await expect(engine.saveFeedback('other-artist', 'Avoid sponsored posts', 'negative'))
            .rejects.toThrow('not active for the signed-in artist');
        ingest.mockRestore();
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
            await expect(engine.ingest('After stop')).rejects.toThrow('Engine not started');
            await expect(engine.query('After stop?')).rejects.toThrow('Engine not started');
            await expect(engine.deleteMemory('old-memory')).rejects.toThrow('Engine not started');
            await expect(engine.clearAll()).rejects.toThrow('Engine not started');
            expect(await engine.consolidateNow()).toBe('Engine not started');
            expect(await engine.getAllMemories()).toEqual([]);
            expect(await engine.getInsights()).toEqual([]);
            expect((await engine.getStatus()).startedAt).toBeUndefined();
            expect(mockGetDocs).not.toHaveBeenCalled();
        });

        it('discards a previous owner read that finishes after an account switch', async () => {
            await engine.start('user-1');
            let finishRead!: (snapshot: { docs: Array<{ id: string; data: () => object }> }) => void;
            mockGetDocs.mockReturnValueOnce(new Promise(resolve => { finishRead = resolve; }));

            const read = engine.getAllMemories();
            await engine.start('user-2');
            finishRead({ docs: [{ id: 'user-1-memory', data: () => ({ content: 'private' }) }] });

            expect(await read).toEqual([]);
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
                    return Promise.resolve('Autonomous agents are growing fast and reliability is a challenge.');
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
            const result = await engine.ingest('Autonomous agents are growing fast but reliability is a challenge.');

            expect(result).toContain('Stored');
            expect(mockAddDoc).toHaveBeenCalled();
        }, 30000);

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
            // ISSUE-042: When no memories exist, fallback to LLM general knowledge
            mockGenerateText.mockResolvedValueOnce(
                'I can help you based on my general knowledge, though I don\'t have personalized memories stored yet. You can ingest information to build your memory base for future queries.'
            );

            const answer = await engine.query('What do I like?');
            expect(answer).toContain('general knowledge');
            expect(answer).toContain('ingest information');
            expect(mockGenerateText).toHaveBeenCalled();
        });

        it('does not synthesize an answer from memories after the owner changes', async () => {
            let finishRead!: (snapshot: { docs: []; empty: boolean }) => void;
            mockGetDocs.mockReturnValueOnce(new Promise(resolve => { finishRead = resolve; }));

            const answer = engine.query('What did the previous artist save?');
            await engine.start('user-2');
            finishRead({ docs: [], empty: true });

            expect(await answer).toContain('account changed');
            expect(mockGenerateText).not.toHaveBeenCalled();
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
            // clearAll() re-queries getDocs in a `while (!batch.empty)` loop to
            // paginate real Firestore deletes (AlwaysOnMemoryEngine.ts:610-643).
            // A static mockResolvedValue that always reports empty:false never
            // terminates that loop — it spins forever, allocating a fresh batch
            // each iteration, until the process OOMs (caught locally: heap grew
            // to 4GB+ and crashed with FATAL ERROR: Reached heap limit). Return
            // one non-empty page, then empty, like real pagination would.
            mockGetDocs
                .mockResolvedValueOnce({
                    docs: [
                        { ref: 'ref-1', id: 'mem-1', data: () => ({}) },
                        { ref: 'ref-2', id: 'mem-2', data: () => ({}) },
                    ],
                    empty: false,
                })
                .mockResolvedValue({ docs: [], empty: true });

            await engine.start('test-user-123');
        });

        it('should clear all memories and insights', async () => {
            const result = await engine.clearAll();

            expect(result.memoriesDeleted).toBeGreaterThanOrEqual(0);
            expect(result.insightsDeleted).toBeGreaterThanOrEqual(0);
        });

        it('does not continue a reset under a different account', async () => {
            let finishRead!: (snapshot: { docs: []; empty: boolean }) => void;
            mockGetDocs.mockReset().mockReturnValueOnce(
                new Promise(resolve => { finishRead = resolve; })
            );

            const clearing = engine.clearAll();
            await engine.start('user-2');
            finishRead({ docs: [], empty: true });

            await expect(clearing).rejects.toThrow('account changed');
            expect(mockWriteBatch).not.toHaveBeenCalled();
        });
    });
});
