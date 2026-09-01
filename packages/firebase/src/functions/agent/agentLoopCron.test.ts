import { describe, expect, it, vi } from 'vitest';
import { processAgentLoopCron } from './agentLoopCron';

describe('agentLoopCron', () => {
    it('creates execution documents in users/{userId}/agentLoopExecutions when definitions have userId', async () => {
        const batchSetMock = vi.fn();
        const batchCommitMock = vi.fn().mockResolvedValue(undefined);

        const mockBatch = {
            set: batchSetMock,
            commit: batchCommitMock,
        };

        const mockDoc = (id: string, data: Record<string, unknown>, parentUserId?: string) => ({
            id,
            data: () => data,
            ref: {
                parent: {
                    parent: parentUserId ? { id: parentUserId } : null,
                },
            },
        });

        const mockDb: any = {
            collectionGroup: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                        docs: [
                            mockDoc('loop-1', { trigger: 'SCHEDULE' }, 'user-abc'),
                        ],
                    }),
                }),
            }),
            collection: vi.fn((path: string) => {
                if (path === 'agentLoopDefinitions') {
                    return {
                        where: vi.fn().mockReturnValue({
                            get: vi.fn().mockResolvedValue({
                                docs: [
                                    mockDoc('loop-2', { trigger: 'SCHEDULE', userId: 'user-xyz' }),
                                ],
                            }),
                        }),
                    };
                }
                if (path === 'users') {
                    return {
                        doc: (userId: string) => ({
                            collection: (subColl: string) => {
                                expect(subColl).toBe('agentLoopExecutions');
                                return {
                                    doc: () => ({ id: `exec-${userId}` }),
                                };
                            },
                        }),
                    };
                }
                return {
                    doc: () => ({ id: 'fallback-doc' }),
                };
            }),
            batch: vi.fn().mockReturnValue(mockBatch),
        };

        const result = await processAgentLoopCron(mockDb);

        expect(result.scheduledCount).toBe(2);
        expect(batchCommitMock).toHaveBeenCalledOnce();
        expect(batchSetMock).toHaveBeenCalledTimes(2);

        // Verify first loop for user-abc
        const firstCall = batchSetMock.mock.calls[0];
        expect(firstCall[1].loopId).toBe('loop-1');
        expect(firstCall[1].userId).toBe('user-abc');
        expect(firstCall[1].status).toBe('IDLE');

        // Verify second loop for user-xyz
        const secondCall = batchSetMock.mock.calls[1];
        expect(secondCall[1].loopId).toBe('loop-2');
        expect(secondCall[1].userId).toBe('user-xyz');
        expect(secondCall[1].status).toBe('IDLE');
    });

    it('returns 0 and does not commit batch if no scheduled loops found', async () => {
        const batchCommitMock = vi.fn();
        const mockDb: any = {
            collectionGroup: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({ docs: [] }),
                }),
            }),
            collection: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({ docs: [] }),
                }),
            }),
            batch: vi.fn().mockReturnValue({ commit: batchCommitMock }),
        };

        const result = await processAgentLoopCron(mockDb);
        expect(result.scheduledCount).toBe(0);
        expect(batchCommitMock).not.toHaveBeenCalled();
    });
});
