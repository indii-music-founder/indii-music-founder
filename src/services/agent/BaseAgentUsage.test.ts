import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { GenAI as AI } from '@/services/ai/GenAI';

// Mock dependencies
vi.mock('@/services/ai/GenAI', () => ({
    serverTimestamp: vi.fn(),
    GenAI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    },
    AI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    }
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(), toMillis: () => Date.now(), toDate: () => new Date()
        })
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
    serverTimestamp: vi.fn(),
    initializeApp: vi.fn(),
    getApp: vi.fn()
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 10, requiresApproval: false }),
        recordSpend: vi.fn().mockResolvedValue(undefined)
    }
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
        const aiMock = await import('@/services/ai/GenAI');
        vi.mocked(aiMock.GenAI.generateContent)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Response content',
                    candidates: [{
                        content: {
                            parts: [{ text: 'Response content' }]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>);

        const response = await agent.execute('Task');
        expect(response.text).toContain('Response content');
        expect(response.usage).toBeUndefined();
    });

    it('should handle response WITH usage method', async () => {
        const aiMock = await import('@/services/ai/GenAI');
        vi.mocked(aiMock.GenAI.generateContent)
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Response content',
                    candidates: [{
                        content: {
                            parts: [{ text: 'Response content' }]
                        }
                    }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 20,
                        totalTokenCount: 30
                    }
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>);

        const response = await agent.execute('Task');
        expect(response.text).toContain('Response content');
        expect(response.usage).toBeDefined();
        expect(response.usage?.promptTokens).toBe(10);
    });
});
