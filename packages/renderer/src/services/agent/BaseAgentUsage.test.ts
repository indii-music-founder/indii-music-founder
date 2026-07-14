import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { importWithRetry } from '@/utils/dynamicImport';

// Mock dependencies
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    serverTimestamp: vi.fn(),
    AutonomousIntelligence: {
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
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContent)
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
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContent)
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

describe('BaseAgent Judgment Layer — generation config + iteration cap', () => {
    const baseConfig: AgentConfig = {
        id: 'generalist',
        name: 'Test Agent',
        description: 'Test',
        color: '#fff',
        category: 'specialist',
        systemPrompt: 'sys prompt',
        tools: []
    };

    function textOnlyResponse(text: string) {
        return {
            response: {
                text: () => text,
                candidates: [{ content: { parts: [{ text }] } }],
                usageMetadata: undefined
            }
        } as unknown as Awaited<ReturnType<typeof AI.generateContent>>;
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies the default maxOutputTokens backstop to the generateContent config', async () => {
        const agent = new BaseAgent(baseConfig);
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContent).mockResolvedValueOnce(textOnlyResponse('done'));

        await agent.execute('Task');

        const callArgs = vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls[0];
        expect(callArgs[2]).toMatchObject({ maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' } });
    });

    it('propagates a per-agent maxOutputTokens override', async () => {
        const agent = new BaseAgent({ ...baseConfig, maxOutputTokens: 1234 });
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContent).mockResolvedValueOnce(textOnlyResponse('done'));

        await agent.execute('Task');

        const callArgs = vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls[0];
        expect(callArgs[2]).toMatchObject({ maxOutputTokens: 1234 });
    });

    it('stops at a custom maxIterations and injects the final-step wrap-up nudge', async () => {
        const agent = new BaseAgent({ ...baseConfig, maxIterations: 3 });
        // Register a trivial, deterministic tool directly so the loop doesn't fall through
        // to the real TOOL_REGISTRY (which would hit unmocked services) — same pattern as
        // the harness distinguishes registered vs. registry-fallback tools (BaseAgent.ts:1190).
        const agentWithFunctions = agent as unknown as { functions: Record<string, () => Promise<{ success: boolean; message: string }>> };
        agentWithFunctions.functions.noop_test_tool = async () => ({ success: true, message: 'ok' });

        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        // Every iteration returns a tool call with fresh args so LoopDetector's
        // consecutive-identical-call check doesn't short-circuit before the iteration cap.
        let callCount = 0;
        vi.mocked(aiMock.AutonomousIntelligence.generateContent).mockImplementation(async () => {
            callCount++;
            return {
                response: {
                    text: () => '',
                    candidates: [{
                        content: {
                            parts: [{ functionCall: { name: 'noop_test_tool', args: { n: callCount } } }]
                        }
                    }],
                    usageMetadata: undefined
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>;
        });

        await agent.execute('Task');

        const calls = vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls;
        expect(calls.length).toBe(3);

        // requestContents is the 1st positional arg; the final call's user-turn text
        // must contain the wrap-up nudge (appended to fullPrompt before the last call).
        const lastCallContents = calls[2][0] as Array<{ parts?: Array<{ text?: string }> }>;
        const lastText = JSON.stringify(lastCallContents);
        expect(lastText).toContain('[SYSTEM — FINAL STEP]');
    });
});
