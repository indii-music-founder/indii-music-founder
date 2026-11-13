/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('../../memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        ingest: vi.fn(),
        ingestWithReceipt: vi.fn(),
        query: vi.fn(),
        getStatus: vi.fn(),
        getAllMemories: vi.fn(),
        deleteMemory: vi.fn(),
        consolidateNow: vi.fn(),
        retrieve: vi.fn()
    }
}));

const bank = vi.hoisted(() => ({ addMemory: vi.fn() }));
vi.mock('../../memory/MemoryBankService', () => ({ memoryBankService: { addMemory: bank.addMemory } }));
import { MemoryTools } from '../MemoryTools';
import { useStore } from '@/core/store';
import { alwaysOnMemoryEngine } from '../../memory/AlwaysOnMemoryEngine';

describe('MemoryTools', () => {
    const mockStoreState = {
        currentProjectId: 'project-123'
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(useStore.getState).mockReturnValue(mockStoreState as unknown as ReturnType<typeof useStore.getState>);
    });

    describe('save_memory', () => {
        it('should save memory successfully via AlwaysOnMemoryEngine', async () => {
            vi.mocked(alwaysOnMemoryEngine.ingestWithReceipt).mockResolvedValue({ status: 'stored', memoryId: 'memory-1', summary: 'Stored info' });

            const result = await MemoryTools.save_memory({
                content: 'User prefers dark themes'
            });

            expect(result.success).toBe(true);
            expect(result.data.memoryId).toBe('memory-1');
            expect(result.message).toContain('Reference: memory-1');
            expect(alwaysOnMemoryEngine.ingestWithReceipt).toHaveBeenCalledWith(
                'User prefers dark themes',
                'agent_extraction',
                'fact'
            );
        });
    });

    describe('truthful write outcomes', () => {
        it.each(['save_memory', 'save_user_memory'] as const)('does not claim a save for skipped/failed %s ingestion', async name => {
            for (const receipt of [{ status: 'skipped' as const, reason: 'duplicate' }, { status: 'unconfirmed' as const, reason: 'write response lost' }]) {
                vi.mocked(alwaysOnMemoryEngine.ingestWithReceipt).mockResolvedValueOnce(receipt);
                const result = await MemoryTools[name]({ content: 'Remember this' });
                expect(result.success).toBe(false);
                expect(result.metadata).toMatchObject({ errorCode: receipt.status === 'skipped' ? 'MEMORY_NOT_SAVED' : 'MEMORY_SAVE_UNCONFIRMED', retryable: false });
                expect(result.message).not.toContain('Memory saved.');
            }
        });
        it('stops unauthenticated indexing before the service call', async () => {
            const result = await MemoryTools.index_memory({ content: 'Remember this' });
            expect(result.success).toBe(false);
            expect(result.metadata).toMatchObject({ errorCode: 'MEMORY_NOT_SAVED', retryable: false });
            expect(bank.addMemory).not.toHaveBeenCalled();
        });
        it('requires semantic index receipts and does not hide rejected writes', async () => {
            vi.mocked(useStore.getState).mockReturnValue({ ...mockStoreState, user: { uid: 'user-1' } } as unknown as ReturnType<typeof useStore.getState>);
            for (const outcome of ['empty', 'rejected', 'saved']) {
                if (outcome === 'rejected') bank.addMemory.mockRejectedValueOnce(new Error('private provider details'));
                else bank.addMemory.mockResolvedValueOnce(outcome === 'saved' ? [{ id: 'semantic-1', memory: 'Remember this' }] : []);
                const result = await MemoryTools.index_memory({ content: 'Remember this' });
                expect(result.success).toBe(outcome === 'saved');
                if (outcome === 'saved') expect(result.message).toContain('Reference: semantic-1');
                else {
                    expect(result.metadata).toMatchObject({ retryable: false, errorCode: 'MEMORY_SAVE_UNCONFIRMED' });
                    expect(result.message).not.toContain('private provider');
                }
            }
        });
    });

    describe('recall_memories', () => {
        it('should recall memories via AlwaysOnMemoryEngine', async () => {
            vi.mocked(alwaysOnMemoryEngine.query).mockResolvedValue('Answer based on memory');

            const result = await MemoryTools.recall_memories({ query: 'user preferences' });

            expect(result.success).toBe(true);
            expect(result.data.answer).toBe('Answer based on memory');
            expect(alwaysOnMemoryEngine.query).toHaveBeenCalledWith('user preferences');
        });
    });

    describe('save_user_memory', () => {
        it('should ingest user memory', async () => {
            vi.mocked(alwaysOnMemoryEngine.ingestWithReceipt).mockResolvedValue({ status: 'stored', memoryId: 'memory-2', summary: 'Summary of memory' });

            const result = await MemoryTools.save_user_memory({
                content: 'Important feedback',
                category: 'feedback'
            });

            expect(result.success).toBe(true);
            expect(result.data.summary).toBe('Summary of memory');
            expect(alwaysOnMemoryEngine.ingestWithReceipt).toHaveBeenCalledWith(
                'Important feedback',
                'user_input',
                'feedback'
            );
        });
    });

    describe('search_user_memory', () => {
        it('should query user memory', async () => {
            vi.mocked(alwaysOnMemoryEngine.query).mockResolvedValue('Search results');

            const result = await MemoryTools.search_user_memory({ query: 'search query' });

            expect(result.success).toBe(true);
            expect(result.data.answer).toBe('Search results');
            expect(alwaysOnMemoryEngine.query).toHaveBeenCalledWith('search query');
        });
    });

    describe('get_user_context', () => {
        it('should return context and status', async () => {
            vi.mocked(alwaysOnMemoryEngine.getStatus).mockResolvedValue({ totalMemories: 10 } as any);
            vi.mocked(alwaysOnMemoryEngine.query).mockResolvedValue('Context summary');

            const result = await MemoryTools.get_user_context({});

            expect(result.success).toBe(true);
            expect(result.data.context).toBe('Context summary');
            expect(result.data.engineStatus.totalMemories).toBe(10);
        });
    });

    describe('delete_user_memory', () => {
        it('is not exposed to agents as a permanent deletion tool', () => {
            expect('delete_user_memory' in MemoryTools).toBe(false);
            expect(alwaysOnMemoryEngine.deleteMemory).not.toHaveBeenCalled();
        });
    });
});
