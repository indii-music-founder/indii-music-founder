/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => write }));
vi.mock('@/services/firebase', () => ({ functions: {} }));
import { memoryBankService } from '../MemoryBankService';

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('MemoryBankService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        write.mockReset();
    });

    it('returns only acknowledged document receipts and redacts before the callable', async () => {
        write.mockResolvedValueOnce({ data: { results: [{ id: 'memory-1', memory: 'Redacted content' }] } });
        expect(await memoryBankService.addMemory('user-1', 'password: superSecretPassword123')).toEqual([{ id: 'memory-1', memory: 'Redacted content' }]);
        expect(write).toHaveBeenCalledWith({ action: 'add', memory: 'password:[REDACTED_SECRET]' });
    });

    it.each([undefined, [], [{}], [{ id: '', memory: 'saved' }], [{ id: 'id', memory: '' }]])('rejects an incomplete save acknowledgement %j', async results => {
        write.mockResolvedValueOnce({ data: { results } });
        await expect(memoryBankService.addMemory('user-1', 'Remember this')).rejects.toThrow('acknowledgement is incomplete');
    });

    it('propagates a lost response without retrying or claiming an empty successful write', async () => {
        const failure = new Error('response lost');
        write.mockRejectedValueOnce(failure);
        await expect(memoryBankService.addMemory('user-1', 'Remember this')).rejects.toBe(failure);
        expect(write).toHaveBeenCalledTimes(1);
    });

    it('continues to distinguish an unavailable search from an empty successful search', async () => {
        write.mockResolvedValueOnce({ data: { results: [], hasMore: false } });
        expect(await memoryBankService.searchMemories('user-1', 'album')).toEqual({ results: [], hasMore: false });
        write.mockRejectedValueOnce(new Error('unavailable'));
        expect(await memoryBankService.searchMemories('user-1', 'album')).toEqual({ results: [], hasMore: false, unavailable: true });
    });

    it('reports one ranked page without repeating a cursorless search', async () => {
        const search = vi.spyOn(memoryBankService, 'searchMemories').mockResolvedValueOnce({
            results: [
                { id: 'a', memory: 'First' },
                { id: 'a', memory: 'First' },
                { id: 'b', memory: 'Second' },
            ],
            hasMore: true,
        });

        const scoped = await memoryBankService.searchMemoriesScoped('user-1', 'album');

        expect(search).toHaveBeenCalledTimes(1);
        expect(scoped.results.map(item => item.id)).toEqual(['a', 'b']);
        expect(scoped.hasMore).toBe(true);
        expect(scoped.scopeMessage).toContain('first ranked memory page');
        expect(scoped.scopeMessage).toContain('More matches may exist');
        search.mockRestore();
    });

    it('distinguishes an unavailable search from a completed empty search', async () => {
        const search = vi.spyOn(memoryBankService, 'searchMemories').mockResolvedValueOnce({
            results: [], hasMore: false, unavailable: true,
        });
        const scoped = await memoryBankService.searchMemoriesScoped('user-1', 'album');
        expect(scoped.scopeMessage).toContain('unavailable');
        expect(scoped.scopeMessage).toContain('were not checked');
        search.mockRestore();
    });
});
