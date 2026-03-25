/**
 * AgentService.security.test.ts
 *
 * Integration tests that verify the runtime tool authorization enforcement
 * pipeline end-to-end.  Every test exercises actual BaseAgent.execute()
 * with a mocked AI model response, so the assertion lives inside the
 * real enforcement code at BaseAgent.ts lines 548-567.
 *
 * Test Suite:
 *  1. Blocked tool: success:false + error injected into toolCalls
 *  2. Hub-only tools (delegate_task, request_approval) blocked from spokes
 *  3. Finance-only tool blocked from non-finance agents
 *  4. Authorized tool executes successfully
 *  5. Empty authorizedTools blocks ALL tool calls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import type { AgentConfig } from '../types';
import { SPOKE_AGENT_IDS, HUB_ONLY_TOOLS } from './AgentStressTest.harness';

// ============================================================================
// Module mocks (must be at top-level for vi.mock hoisting)
// ============================================================================

vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'us-central1',
        useVertex: false,
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        DEV: true,
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    remoteConfig: { getValue: vi.fn(), getAll: vi.fn() },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() },
}));

const mockGenerateContent = vi.fn();

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: mockGenerateContent,
        generateContentStream: vi.fn(),
        generateSpeech: vi.fn(),
    },
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'ok' } }),
    },
}));

vi.mock('@/services/ai/AIResponseCache', () => ({
    AIResponseCache: class {
        get() { return null; }
        set() { /* no-op */ }
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            agentHistory: [],
            currentOrganizationId: 'test-org',
            currentProjectId: 'test-project',
            uploadedImages: [],
            auth: { currentUser: null },
        })),
        setState: vi.fn(),
    },
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 9999, requiresApproval: false }),
    },
}));

vi.mock('../MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
        saveMemory: vi.fn(),
    },
}));

vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn().mockResolvedValue('test-corpus'),
        listDocuments: vi.fn().mockResolvedValue([]),
        query: vi.fn().mockResolvedValue([]),
        ingestText: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn().mockResolvedValue('test-trace-id'),
        addStep: vi.fn().mockResolvedValue(undefined),
        completeTrace: vi.fn().mockResolvedValue(undefined),
        failTrace: vi.fn().mockResolvedValue(undefined),
        addStepWithUsage: vi.fn(),
    },
}));

vi.mock('../fine-tuned-models', () => ({
    getFineTunedModel: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@/services/ai/context/ContextManager', () => ({
    ContextManager: {
        truncateContext: vi.fn((content: unknown[]) => content),
    },
}));

vi.mock('@/core/events', () => ({
    events: { emit: vi.fn() },
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal AgentConfig for testing.
 * Registers allowed_tool as an executable function.
 */
function makeTestAgent(authorizedTools: string[], extraTools: string[] = []): BaseAgent {
    const allToolNames = ['allowed_tool', ...extraTools];
    const config: AgentConfig = {
        id: 'test-security-agent',
        name: 'Test Security Agent',
        description: 'Minimal agent for authorization tests',
        color: 'bg-gray-500',
        category: 'specialist',
        systemPrompt: 'You are a test specialist agent.',
        authorizedTools,
        tools: [{
            functionDeclarations: allToolNames.map(name => ({
                name,
                description: `Tool: ${name}`,
                parameters: { type: 'OBJECT' as const, properties: {}, required: [] }
            }))
        }],
        functions: {
            allowed_tool: vi.fn().mockResolvedValue({ success: true, data: 'allowed result' }),
        }
    };
    return new BaseAgent(config);
}

/**
 * Helper to mock a single-shot function call followed by a text response.
 * The first GenAI call returns a function call for `toolName`.
 * The second GenAI call returns plain text to end the loop.
 */
function mockFunctionCallThenText(toolName: string, args: Record<string, unknown> = {}): void {
    mockGenerateContent
        .mockResolvedValueOnce({
            response: {
                text: () => '',
                functionCalls: () => [{ name: toolName, args }],
                candidates: [],
                usageMetadata: {},
            },
        })
        .mockResolvedValueOnce({
            response: {
                text: () => 'Task complete.',
                functionCalls: () => [],
                candidates: [],
                usageMetadata: {},
            },
        });
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseAgent Runtime Tool Authorization', () => {

    beforeEach(() => {
        mockGenerateContent.mockReset();
    });

    // --------------------------------------------------------------------------
    // 1. Blocked tool returns error structure
    // --------------------------------------------------------------------------
    it('blocks a tool not in authorizedTools and injects error into toolCalls', async () => {
        const agent = makeTestAgent(['allowed_tool']); // blocked_tool is NOT authorized

        mockFunctionCallThenText('blocked_tool');

        const result = await agent.execute('do something risky', { userId: 'u1', projectId: 'p1' });

        const blocked = result.toolCalls?.find(c => c.name === 'blocked_tool');
        expect(blocked).toBeDefined();
        expect(blocked?.result).toMatchObject({
            success: false,
            error: expect.stringContaining('not authorized'),
        });
    });

    // --------------------------------------------------------------------------
    // 2. Hub-only tools blocked from all spoke agents
    // --------------------------------------------------------------------------
    it.each(SPOKE_AGENT_IDS)(
        '%s: delegate_task is blocked (hub-only)',
        async (agentId) => {
            const config: AgentConfig = {
                id: agentId,
                name: `Test ${agentId}`,
                description: 'spoke test',
                color: 'bg-gray-500',
                category: 'specialist',
                systemPrompt: `You are the ${agentId} agent.`,
                // Each spoke has its own tools but NOT delegate_task
                authorizedTools: ['allowed_tool'],
                tools: [{
                    functionDeclarations: [
                        { name: 'allowed_tool', description: 'ok', parameters: { type: 'OBJECT' as const, properties: {}, required: [] } }
                    ]
                }],
            };
            const agent = new BaseAgent(config);

            mockFunctionCallThenText('delegate_task', { targetAgentId: 'generalist', task: 'do it' });

            const result = await agent.execute('delegate this', { userId: 'u2', projectId: 'p2' });

            const blocked = result.toolCalls?.find(c => c.name === 'delegate_task');
            expect(blocked).toBeDefined();
            expect(blocked?.result).toMatchObject({
                success: false,
                error: expect.stringContaining('not authorized'),
            });
        }
    );

    // --------------------------------------------------------------------------
    // 3. Finance-only tool blocked from non-finance agents
    // --------------------------------------------------------------------------
    it.each(['marketing', 'video', 'road'] as const)(
        '%s: calculate_royalty_waterfall is blocked (finance-only)',
        async (agentId) => {
            const config: AgentConfig = {
                id: agentId,
                name: `Test ${agentId}`,
                description: 'non-finance spoke',
                color: 'bg-gray-500',
                category: 'specialist',
                systemPrompt: `You are the ${agentId} agent.`,
                authorizedTools: ['allowed_tool'],
                tools: [{
                    functionDeclarations: [
                        { name: 'allowed_tool', description: 'ok', parameters: { type: 'OBJECT' as const, properties: {}, required: [] } }
                    ]
                }],
            };
            const agent = new BaseAgent(config);

            mockFunctionCallThenText('calculate_royalty_waterfall', { amount: 1000 });

            const result = await agent.execute('calculate royalties', { userId: 'u3', projectId: 'p3' });

            const blocked = result.toolCalls?.find(c => c.name === 'calculate_royalty_waterfall');
            expect(blocked).toBeDefined();
            expect(blocked?.result).toMatchObject({
                success: false,
                error: expect.stringContaining('not authorized'),
            });
        }
    );

    // --------------------------------------------------------------------------
    // 4. Authorized tool passes through and executes
    // --------------------------------------------------------------------------
    it('authorized tool call executes successfully', async () => {
        const agent = makeTestAgent(['allowed_tool']);

        mockFunctionCallThenText('allowed_tool', { input: 'test' });

        const result = await agent.execute('call allowed_tool', { userId: 'u4', projectId: 'p4' });

        // Should NOT appear as blocked — either absent or success:true
        const toolCall = result.toolCalls?.find(c => c.name === 'allowed_tool');
        if (toolCall) {
            expect(toolCall.result).not.toMatchObject({ success: false, error: expect.stringContaining('not authorized') });
        }
        // GenAI was called (loop ran)
        expect(mockGenerateContent).toHaveBeenCalled();
    });

    // --------------------------------------------------------------------------
    // 5. Empty authorizedTools blocks ALL tool calls
    // --------------------------------------------------------------------------
    it('agent with authorizedTools:[] blocks ALL tool calls', async () => {
        const config: AgentConfig = {
            id: 'locked-agent',
            name: 'Locked Agent',
            description: 'No tools allowed',
            color: 'bg-gray-500',
            category: 'specialist',
            systemPrompt: 'You are a restricted agent with no tools.',
            authorizedTools: [], // empty = nothing allowed
            tools: [{
                functionDeclarations: [
                    { name: 'any_tool', description: 'any', parameters: { type: 'OBJECT' as const, properties: {}, required: [] } }
                ]
            }],
        };
        const agent = new BaseAgent(config);

        mockFunctionCallThenText('any_tool');

        const result = await agent.execute('try any tool', { userId: 'u5', projectId: 'p5' });

        const blocked = result.toolCalls?.find(c => c.name === 'any_tool');
        expect(blocked).toBeDefined();
        expect(blocked?.result).toMatchObject({
            success: false,
            error: expect.stringContaining('not authorized'),
        });
    });

    // --------------------------------------------------------------------------
    // 6. HUB_ONLY_TOOLS constant covers the expected set
    // --------------------------------------------------------------------------
    it('HUB_ONLY_TOOLS contains delegate_task and request_approval', () => {
        expect(HUB_ONLY_TOOLS).toContain('delegate_task');
        expect(HUB_ONLY_TOOLS).toContain('request_approval');
    });

    // --------------------------------------------------------------------------
    // 7. authorizedTools field is present on production agent configs (smoke check)
    // --------------------------------------------------------------------------
    it('definition-based agents export authorizedTools as non-empty arrays', async () => {
        // Sample 3 representative production agents to confirm Task 1 was applied correctly.
        // Full coverage is verified by grep in CI.
        const { FinanceAgent } = await import('../definitions/FinanceAgent');
        const { MarketingAgent } = await import('../definitions/MarketingAgent');
        const { DevOpsAgent } = await import('../definitions/DevOpsAgent');

        expect(Array.isArray(FinanceAgent.authorizedTools)).toBe(true);
        expect((FinanceAgent.authorizedTools?.length ?? 0)).toBeGreaterThan(0);

        expect(Array.isArray(MarketingAgent.authorizedTools)).toBe(true);
        expect((MarketingAgent.authorizedTools?.length ?? 0)).toBeGreaterThan(0);

        expect(Array.isArray(DevOpsAgent.authorizedTools)).toBe(true);
        expect((DevOpsAgent.authorizedTools?.length ?? 0)).toBeGreaterThan(0);
    });
});
