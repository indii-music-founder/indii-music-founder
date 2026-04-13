
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { MembershipService } from '@/services/MembershipService';

// Mock dependencies
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateSpeech: vi.fn(),
        generateImage: vi.fn()
    },
    AI_MODELS: { TEXT: { AGENT: 'mock-model' } },
    AI_CONFIG: { THINKING: { LOW: {} } }
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn(() => Promise.resolve({ allowed: true })),
        recordSpend: vi.fn().mockResolvedValue(true),
        getCurrentUserId: vi.fn().mockResolvedValue('ledger-test-user'),
        getCurrentTier: vi.fn().mockResolvedValue('free'),
        getTierDisplayName: vi.fn().mockReturnValue('Free'),
        getLimits: vi.fn().mockReturnValue({ maxDailySpend: 1.0 })
    }
}));

// Mock lazy imports inside BaseAgent
vi.mock('./AgentService', () => ({
    agentService: { runAgent: vi.fn() }
}));
vi.mock('./utils/ToolUtils', () => ({
    toolError: (msg: string) => ({ success: false, error: msg })
}));
vi.mock('./ProactiveService', () => ({
    proactiveService: { scheduleTask: vi.fn(), subscribeToEvent: vi.fn() }
}));
vi.mock('@/core/events', () => ({
    events: { emit: vi.fn() }
}));
vi.mock('@/services/audio/AudioService', () => ({
    audioService: { play: vi.fn() }
}));
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({ projects: [] }),
        setState: vi.fn()
    }
}));
vi.mock('./tools', () => ({
    TOOL_REGISTRY: {}
}));

describe('BaseAgent Cost Circuit Breaker', () => {
    let agent: BaseAgent;
    const mockConfig: AgentConfig = {
        id: 'ledger-agent',
        name: 'Ledger Agent',
        description: 'Testing Agent for Budgets',
        color: 'green',
        category: 'manager',
        systemPrompt: 'You are a test agent.',
        tools: []
    } as unknown as AgentConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new BaseAgent(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('🛑 should stop execution when budget is exceeded (Cost Circuit Breaker)', async () => {
        const { GenAI: AI } = await import('@/services/ai/GenAI');

        // Setup: Agent wants to run 5 iterations
        // 1. First iteration: Uses 0.10. Budget OK. -> Calls Tool "dummy_tool"
        // 2. Second iteration: Uses 0.50. Budget OK. -> Calls Tool "dummy_tool" (different args)
        // 3. Third iteration: Budget EXCEEDED. -> STOPS

        const dummyToolCall1 = {
            name: 'dummy_tool',
            args: { purpose: 'spend money first' }
        };
        const dummyToolCall2 = {
            name: 'dummy_tool',
            args: { purpose: 'spend money again' }
        };

        vi.mocked(AI.generateContent)
            .mockResolvedValueOnce({ // Iteration 1
                response: {
                    text: () => 'I need to use a tool.',
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'I need to use a tool.' },
                                { functionCall: dummyToolCall1 }
                            ]
                        }
                    }],
                    usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 500, totalTokenCount: 1000 }
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>)
            .mockResolvedValueOnce({ // Iteration 2
                response: {
                    text: () => 'I need to use another tool.',
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'I need to use another tool.' },
                                { functionCall: dummyToolCall2 }
                            ]
                        }
                    }],
                    usageMetadata: { promptTokenCount: 2500, candidatesTokenCount: 2500, totalTokenCount: 5000 }
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>)
            // Iteration 3: AI should NOT be called.
            .mockResolvedValue({
                response: {
                    text: () => 'This should not be reached.',
                    candidates: [{
                        content: {
                            parts: [{ text: 'This should not be reached.' }]
                        }
                    }],
                    usageMetadata: { totalTokenCount: 1000 }
                }
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>);

        // Mock Budget Check
        // Iteration 1 check: Allowed
        vi.mocked(MembershipService.checkBudget).mockResolvedValueOnce({ allowed: true, remainingBudget: 0.90 } as unknown as Awaited<ReturnType<typeof MembershipService.checkBudget>>);
        // Iteration 2 check: Allowed
        vi.mocked(MembershipService.checkBudget).mockResolvedValueOnce({ allowed: true, remainingBudget: 0.40 } as unknown as Awaited<ReturnType<typeof MembershipService.checkBudget>>);
        // Iteration 3 check: FAILED
        vi.mocked(MembershipService.checkBudget).mockResolvedValueOnce({ allowed: false, remainingBudget: -0.10 } as unknown as Awaited<ReturnType<typeof MembershipService.checkBudget>>);

        const response = await agent.execute('Run expensive task');

        // Assertions
        expect(MembershipService.checkBudget).toHaveBeenCalledTimes(3);
        expect(response.error).toContain('Daily spend limit reached');
        expect(response.text).toContain('paused');

        expect(AI.generateContent).toHaveBeenCalledTimes(2);
    });
});
