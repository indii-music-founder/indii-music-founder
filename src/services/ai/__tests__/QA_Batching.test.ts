import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';
import { RequestBatcher } from '../../../utils/RequestBatcher';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    functions: {},
    ai: {},
    remoteConfig: {},
    db: {},
    auth: { currentUser: { uid: 'user-batch' } }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

// Mock firebase/ai wrapped
const mockBatchEmbedContents = vi.fn();
const mockEmbedContent = vi.fn();

vi.mock('firebase/ai', () => ({
    __esModule: true,
    getGenerativeModel: vi.fn(() => ({
        // Simulate SDK capability check
        // batchEmbedContents: mockBatchEmbedContents, // Commented out to test polyfill first
        embedContent: mockEmbedContent
    })),
    Schema: {},
    Tool: {}
}));

describe('Request Batching QA', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseAIService();
    });

    describe('FirebaseAIService.batchEmbedContents (Polyfill)', () => {
        it('should fallback to concurrent embedContent requests', async () => {
            mockEmbedContent.mockResolvedValue({ embedding: { values: [1, 2, 3] } });

            const results = await service.batchEmbedContents([
                { role: 'user', parts: [{ text: '1' }] },
                { role: 'user', parts: [{ text: '2' }] }
            ]);

            expect(mockEmbedContent).toHaveBeenCalledTimes(2);
            expect(results).toHaveLength(2);
            expect(results[0]).toEqual([1, 2, 3]);
        });
    });

    describe('RequestBatcher Utility', () => {
        it('should batch requests up to maxBatchSize', async () => {
            const processor = vi.fn().mockImplementation(async (items) => items.map((i: any) => i * 2));
            const batcher = new RequestBatcher<number, number>(processor, { maxBatchSize: 3, maxWaitMs: 100 });

            const p1 = batcher.add(1);
            const p2 = batcher.add(2);
            const p3 = batcher.add(3);

            const results = await Promise.all([p1, p2, p3]);

            expect(results).toEqual([2, 4, 6]);
            // Should flush immediately when size reached
            expect(processor).toHaveBeenCalledTimes(1);
            expect(processor).toHaveBeenCalledWith([1, 2, 3]);
        });

        it('should flush after timeout if batch not full', async () => {
            vi.useFakeTimers();
            const processor = vi.fn().mockImplementation(async (items) => items.map((i: any) => i * 2));
            const batcher = new RequestBatcher<number, number>(processor, { maxBatchSize: 5, maxWaitMs: 1000 });

            const p1 = batcher.add(10);

            vi.advanceTimersByTime(1100);

            const res = await p1;
            expect(res).toBe(20);
            expect(processor).toHaveBeenCalledTimes(1);
            vi.useRealTimers();
        });
    });
});
