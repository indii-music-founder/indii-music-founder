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
        query: vi.fn(),
        getStatus: vi.fn(),
        getAllMemories: vi.fn(),
        deleteMemory: vi.fn(),
        consolidateNow: vi.fn(),
        retrieve: vi.fn()
    }
}));

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
            vi.mocked(alwaysOnMemoryEngine.ingest).mockResolvedValue('Stored: info');

            const result = await MemoryTools.save_memory({
                content: 'User prefers dark themes'
            });

            expect(result.success).toBe(true);
            expect(result.data.message).toContain('Memory stored');
            expect(alwaysOnMemoryEngine.ingest).toHaveBeenCalledWith(
                'User prefers dark themes',
                'agent_extraction',
                'fact'
            );
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
            vi.mocked(alwaysOnMemoryEngine.ingest).mockResolvedValue('Summary of memory');

            const result = await MemoryTools.save_user_memory({
                content: 'Important feedback',
                category: 'feedback'
            });

            expect(result.success).toBe(true);
            expect(result.data.summary).toBe('Summary of memory');
            expect(alwaysOnMemoryEngine.ingest).toHaveBeenCalledWith(
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
        it('should delete specified memory', async () => {
            const result = await MemoryTools.delete_user_memory({ memoryId: 'mem-1' });

            expect(result.success).toBe(true);
            expect(alwaysOnMemoryEngine.deleteMemory).toHaveBeenCalledWith('mem-1');
        });
    });
});
