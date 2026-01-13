import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    }
}));

vi.mock('firebase/firestore', () => ({
    Timestamp: {
        now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() })
    },
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(),
    getApp: vi.fn()
}));

describe('BaseAgent Usage Defenses', () => {
    let agent: BaseAgent;
    const config: AgentConfig = {
        id: 'generalist',
        name: 'Test Agent',
        description: 'Test',
        color: '#fff',
        category: 'specialist',
        systemPrompt: 'sys prompt',
        tools: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new BaseAgent(config);
    });

    it('should handle response WITHOUT usage method gracefully', async () => {
        const aiMock = await import('@/services/ai/AIService');
        vi.mocked(aiMock.AI.generateContentStream).mockResolvedValue({
            stream: {
                getReader: () => ({
                    read: vi.fn()
                        .mockResolvedValueOnce({ done: false, value: { text: () => 'Response content' } })
                        .mockResolvedValueOnce({ done: true }),
                    releaseLock: vi.fn()
                })
            },
            response: Promise.resolve({
                text: () => 'Response content',
                functionCalls: () => []
                // Intentionally OMITTING usage()
            })
        } as any);

        const response = await agent.execute('Task');
        expect(response.text).toContain('Response content');
        expect(response.usage).toBeUndefined();
    });

    it('should handle response WITH usage method', async () => {
        const aiMock = await import('@/services/ai/AIService');
        vi.mocked(aiMock.AI.generateContentStream).mockResolvedValue({
            stream: {
                getReader: () => ({
                    read: vi.fn()
                        .mockResolvedValueOnce({ done: false, value: { text: () => 'Response content' } })
                        .mockResolvedValueOnce({ done: true }),
                    releaseLock: vi.fn()
                })
            },
            response: Promise.resolve({
                text: () => 'Response content',
                functionCalls: () => [],
                usage: () => ({
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30
                })
            })
        } as any);

        const response = await agent.execute('Task');
        expect(response.text).toContain('Response content');
        expect(response.usage).toBeDefined();
        expect(response.usage?.promptTokens).toBe(10);
    });
});
