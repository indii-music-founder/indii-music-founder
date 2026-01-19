
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig, ToolDefinition } from './types';
import { MembershipService } from '@/services/MembershipService';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
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
        getCurrentTier: vi.fn().mockResolvedValue('free')
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
        id: 'ledger-agent' as any,
        name: 'Ledger Agent',
        description: 'Testing Agent for Budgets',
        color: 'green',
        category: 'manager',
        systemPrompt: 'You are a test agent.',
        tools: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new BaseAgent(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('🛑 should stop execution when budget is exceeded (Cost Circuit Breaker)', async () => {
        const { AI } = await import('@/services/ai/AIService');

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

        (AI.generateContent as any)
            .mockResolvedValueOnce({ // Iteration 1
                text: () => 'I need to use a tool.',
                functionCalls: () => [dummyToolCall1],
                usage: () => ({ totalTokenCount: 1000 })
            })
            .mockResolvedValueOnce({ // Iteration 2
                text: () => 'I need to use another tool.',
                functionCalls: () => [dummyToolCall2],
                usage: () => ({ totalTokenCount: 5000 })
            })
            // Iteration 3: AI should NOT be called.
            .mockResolvedValue({
                text: () => 'This should not be reached.',
                functionCalls: () => [],
                usage: () => ({ totalTokenCount: 1000 })
            });

        // Mock Budget Check
        // Iteration 1 check: Allowed
        (MembershipService.checkBudget as any).mockResolvedValueOnce({ allowed: true, remainingBudget: 0.90 });
        // Iteration 2 check: Allowed
        (MembershipService.checkBudget as any).mockResolvedValueOnce({ allowed: true, remainingBudget: 0.40 });
        // Iteration 3 check: FAILED
        (MembershipService.checkBudget as any).mockResolvedValueOnce({ allowed: false, remainingBudget: -0.10 });

        const response = await agent.execute('Run expensive task');

        // Assertions
        expect(MembershipService.checkBudget).toHaveBeenCalledTimes(3);
        expect(response.error).toContain('Budget exceeded');
        expect(response.text).toContain('halted');

        expect(AI.generateContent).toHaveBeenCalledTimes(2);
    });
});
