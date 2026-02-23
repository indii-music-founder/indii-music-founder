
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { MembershipService } from '@/services/MembershipService';
import { GenAI as AI } from '@/services/ai/GenAI';

// Mock dependencies
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateSpeech: vi.fn(),
        generateImage: vi.fn()
    },
    AI: {
        generateContent: vi.fn()
    },
    AI_MODELS: {
        TEXT: { AGENT: 'gemini-3-pro-preview' }
    },
    AI_CONFIG: { THINKING: { LOW: {} } }
}));

// We need a stateful mock for MembershipService to test the loop interaction
const mockUsageState = {
    totalSpend: 0,
    limit: 1.00 // $1.00 Hard Limit
};

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn(async (estimatedCost: number) => {
            const allowed = (mockUsageState.totalSpend + estimatedCost) <= mockUsageState.limit;
            return {
                allowed,
                remainingBudget: mockUsageState.limit - mockUsageState.totalSpend
            };
        }),
        recordSpend: vi.fn(async (_userId: string, amount: number) => {
            mockUsageState.totalSpend += amount;
            // console.log(`[MockLedger] Recorded spend: $${amount.toFixed(4)}. Total: $${mockUsageState.totalSpend.toFixed(4)}`);
        }),
        getCurrentUserId: vi.fn().mockResolvedValue('ledger-test-user'),
        getCurrentTier: vi.fn().mockResolvedValue('free')
    }
}));

// Mock other dependencies to avoid crashes
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
vi.mock('./context/AgentExecutionContext', () => ({
    ExecutionContextFactory: {
        fromAgentContext: () => ({
            rollback: vi.fn(),
            commit: vi.fn(),
            hasUncommittedChanges: vi.fn().mockReturnValue(false),
            getChangeSummary: vi.fn().mockReturnValue('')
        })
    },
    ToolExecutionContext: vi.fn()
}));

describe('Ledger Circuit Breaker (Integration)', () => {
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
        // Reset state
        mockUsageState.totalSpend = 0;
        mockUsageState.limit = 1.00;

        agent = new BaseAgent(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('💸 stops execution when "Fake High Usage" metadata triggers the budget limit', async () => {
        // SCENARIO:
        // 1. Agent starts. Budget Check (0) -> Allowed (Spend 0 <= 1.00).
        // 2. Agent calls AI. AI returns "Fake High Usage" (Cost > $1.00).
        // 3. Agent *should* call recordSpend. Total Spend becomes > $1.00.
        // 4. Loop continues to Iteration 2.
        // 5. Budget Check (0) -> Denied (Spend > 1.00).
        // 6. Agent halts.

        // Setup AI Mock
        const dummyToolCall = {
            name: 'dummy_tool',
            args: { purpose: 'spend money' }
        };

        (AI.generateContent as any)
            .mockResolvedValueOnce({ // Iteration 1
                response: {
                    text: () => 'I am spending a lot of tokens!',
                    candidates: [{
                        content: {
                            parts: [
                                { text: 'I am spending a lot of tokens!' },
                                { functionCall: dummyToolCall }
                            ]
                        }
                    }],
                    usageMetadata: {
                        promptTokenCount: 1000000, // 1M input tokens ($2.50 for pro)
                        candidatesTokenCount: 0,
                        totalTokenCount: 1000000
                    }
                }
            })
            .mockResolvedValueOnce({ // Iteration 2 (Should NOT be reached)
                response: {
                    text: () => 'I should not be running.',
                    candidates: [{
                        content: {
                            parts: [{ text: 'I should not be running.' }]
                        }
                    }],
                    usageMetadata: { totalTokenCount: 100 }
                }
            });

        // Execute
        const response = await agent.execute('Run expensive task', { userId: 'ledger-test-user' });

        // Assertions

        // 1. Verify recordSpend was called with correct amount
        // Input cost for gemini-3-pro-preview is $2.50 per 1M.
        // We used 1M tokens. Cost should be $2.50.
        expect(MembershipService.recordSpend).toHaveBeenCalledWith('ledger-test-user', 2.5);

        // 2. Verify Budget Check was called twice
        // Once at start (allowed), once at second iteration (denied)
        expect(MembershipService.checkBudget).toHaveBeenCalledTimes(2);

        // 3. Verify Agent halted
        expect(response.error).toContain('Budget exceeded');

        // 4. Verify AI was only called once (because 2nd iteration was blocked)
        expect(AI.generateContent).toHaveBeenCalledTimes(1);

        console.log(`💸 [Ledger] Test Verification:
        - Spend Recorded: $${mockUsageState.totalSpend}
        - Circuit Breaker Tripped: ${response.error}
        `);
    });
});
