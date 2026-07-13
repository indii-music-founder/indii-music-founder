/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    });

    it('should fail closed without calling Mem0 from the browser in addMemory', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([{ id: 'm1', memory: 'Redacted text' }]),
        });
        global.fetch = fetchMock;

        const rawContent = 'My card is 1234-5678-9012-3456 and password: "superSecretPassword123"';
        const result = await memoryBankService.addMemory('user-1', rawContent);

        expect(result).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should fail closed without calling Mem0 for secret-like content', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });
        global.fetch = fetchMock;

        const rawContent = 'API key is apiKey=myAwesomeApiKey123';
        const result = await memoryBankService.addMemory('user-1', rawContent);

        expect(result).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should fail closed without calling Mem0 in searchMemories', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });
        global.fetch = fetchMock;

        const query = 'Find info for secret: "topSecretToken" and credit card 4111 1111 1111 1111';
        const result = await memoryBankService.searchMemories('user-1', query);

        expect(result).toEqual({ results: [], hasMore: false });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
