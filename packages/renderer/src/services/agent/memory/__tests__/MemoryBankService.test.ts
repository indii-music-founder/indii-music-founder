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
        // Setup API key for tests
        (memoryBankService as any).apiKey = 'test-token';
    });

    it('should redact credit cards and secrets in addMemory', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([{ id: 'm1', memory: 'Redacted text' }]),
        });
        global.fetch = fetchMock;

        const rawContent = 'My card is 1234-5678-9012-3456 and password: "superSecretPassword123"';
        await memoryBankService.addMemory('user-1', rawContent);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0] as any[];
        expect(url).toBe('https://api.mem0.ai/v2/memories/');
        
        const body = JSON.parse(options.body);
        const sentContent = body.messages[0].content;
        
        expect(sentContent).toContain('[REDACTED_CREDIT_CARD]');
        expect(sentContent).toContain('password:"[REDACTED_SECRET]"');
        expect(sentContent).not.toContain('1234-5678-9012-3456');
        expect(sentContent).not.toContain('superSecretPassword123');
    });

    it('should redact secrets with equals separator and no quotes', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });
        global.fetch = fetchMock;

        const rawContent = 'API key is apiKey=myAwesomeApiKey123';
        await memoryBankService.addMemory('user-1', rawContent);

        const [, options] = fetchMock.mock.calls[0] as any[];
        const sentContent = JSON.parse(options.body).messages[0].content;

        expect(sentContent).toContain('apiKey=[REDACTED_SECRET]');
        expect(sentContent).not.toContain('myAwesomeApiKey123');
    });

    it('should redact credit cards and secrets in searchMemories query', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });
        global.fetch = fetchMock;

        const query = 'Find info for secret: "topSecretToken" and credit card 4111 1111 1111 1111';
        await memoryBankService.searchMemories('user-1', query);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0] as any[];
        expect(url).toBe('https://api.mem0.ai/v2/memories/search/');

        const body = JSON.parse(options.body);
        expect(body.query).toContain('secret:"[REDACTED_SECRET]"');
        expect(body.query).toContain('[REDACTED_CREDIT_CARD]');
        expect(body.query).not.toContain('topSecretToken');
        expect(body.query).not.toContain('4111 1111 1111 1111');
    });
});
