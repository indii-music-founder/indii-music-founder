import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkedBatch } from './chunkedBatch';

describe('ISSUE-1554: ChunkedBatch Safety Rail', () => {
    let mockCommit: any;
    let mockBatch: any;
    let mockDb: any;

    beforeEach(() => {
        mockCommit = vi.fn().mockResolvedValue([]);
        mockBatch = {
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: mockCommit,
        };
        mockDb = {
            batch: vi.fn(() => mockBatch),
        };
    });

    it('flushes operations in chunks of max 400 when more than 500 writes occur', async () => {
        const chunked = new ChunkedBatch(mockDb, 400);

        // Perform 950 set operations (which would crash standard Firestore batch)
        for (let i = 0; i < 950; i++) {
            const mockRef = { id: `doc_${i}` } as any;
            await chunked.set(mockRef, { index: i });
        }

        // At 950 operations with chunk size 400:
        // Batch 1 (400) flushed automatically
        // Batch 2 (400) flushed automatically
        // 150 pending
        expect(mockCommit).toHaveBeenCalledTimes(2);

        // Explicit commit should flush the remaining 150
        const result = await chunked.commit();
        expect(mockCommit).toHaveBeenCalledTimes(3);
        expect(result.totalWrites).toBe(950);
    });

    it('handles mixed set, update, and delete calls safely', async () => {
        const chunked = new ChunkedBatch(mockDb, 10);

        for (let i = 0; i < 5; i++) {
            await chunked.set({ id: `s_${i}` } as any, { val: i });
        }
        for (let i = 0; i < 5; i++) {
            await chunked.update({ id: `u_${i}` } as any, { val: i });
        }
        // At 10, should flush batch 1
        expect(mockCommit).toHaveBeenCalledTimes(1);

        for (let i = 0; i < 3; i++) {
            await chunked.delete({ id: `d_${i}` } as any);
        }
        const result = await chunked.commit();
        expect(mockCommit).toHaveBeenCalledTimes(2);
        expect(result.totalWrites).toBe(13);
    });
});
