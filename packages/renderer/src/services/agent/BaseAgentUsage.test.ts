// Structural-only orchestration tests with literal tool outcomes; deployed behavior remains unverified.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { importWithRetry } from '@/utils/dynamicImport';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { recordToolOutcome } from './governance/ToolOutcomeAudit';
import type { ToolFunctionResult } from './types';

vi.mock('./governance/ToolOutcomeAudit', () => ({
    recordToolOutcome: vi.fn(async () => ({ status: 'unavailable' })),
}));

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

vi.mock('./registry', () => ({
    agentRegistry: {
        get: vi.fn((agentId: string) => ({ id: agentId, name: agentId })),
    },
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
        authorizedTools: ['noop_test_tool', 'generate_image', 'calendar_lookup'],
        tools: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(AI.generateContent).mockReset();
        vi.mocked(AI.generateContentStream).mockReset();
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

        const onProgress = vi.fn();
        const response = await agent.execute('Task', undefined, onProgress);
        expect(response.text).toContain('Response content');
        const usage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
        expect(response.usage).toEqual(usage);
        expect(onProgress.mock.calls.map(([event]) => event).filter(event => event.type === 'usage'))
            .toEqual([expect.objectContaining({ type: 'usage', usage })]);
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
        authorizedTools: ['noop_test_tool', 'generate_image', 'calendar_lookup'],
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
        vi.mocked(AI.generateContent).mockReset();
        vi.mocked(AI.generateContentStream).mockReset();
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
        const agent = new BaseAgent({ ...baseConfig, maxIterations: 3, authorizedTools: ['noop_test_tool'] });
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

    it('withholds tools on the final step and never ends with a bare iteration-limit message', async () => {
        const agent = new BaseAgent({
            ...baseConfig,
            maxIterations: 2,
            authorizedTools: ['noop_test_tool'],
            tools: [{ functionDeclarations: [{ name: 'noop_test_tool', description: 'No-op test tool', parameters: { type: 'OBJECT', properties: {} } }] }],
        } as ConstructorParameters<typeof BaseAgent>[0]);
        const agentWithFunctions = agent as unknown as { functions: Record<string, () => Promise<{ success: boolean; message: string }>> };
        agentWithFunctions.functions.noop_test_tool = async () => ({ success: true, message: 'ok' });
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        let callCount = 0;
        vi.mocked(aiMock.AutonomousIntelligence.generateContent).mockImplementation(async () => {
            callCount++;
            return {
                response: {
                    text: () => '',
                    candidates: [{ content: { parts: [{ functionCall: { name: 'noop_test_tool', args: { n: callCount } } }] } }],
                    usageMetadata: undefined,
                },
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>;
        });

        const result = await agent.execute('Task');

        const calls = vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls;
        expect(calls).toHaveLength(2);
        const firstTools = calls[0]?.[4] as Array<{ functionDeclarations: Array<{ name: string }> }>;
        expect(firstTools.flatMap(tool => tool.functionDeclarations.map(fn => fn.name)).length).toBeGreaterThan(0);
        expect(calls[1]?.[4]).toEqual([]);
        expect(result.text).not.toBe('Maximum iterations reached.');
        expect(result.text).toContain('step limit');
        expect(result.text).toContain('No action was completed.');
    });

    it('caps a Boardroom specialist at the server-owned per-agent iteration budget', async () => {
        const agent = new BaseAgent({ ...baseConfig, maxIterations: 8 });
        const agentWithFunctions = agent as unknown as { functions: Record<string, () => Promise<{ success: boolean; message: string }>> };
        agentWithFunctions.functions.noop_test_tool = async () => ({ success: true, message: 'ok' });
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        let callCount = 0;
        vi.mocked(aiMock.AutonomousIntelligence.generateContent).mockImplementation(async () => {
            callCount++;
            return {
                response: {
                    text: () => '',
                    candidates: [{ content: { parts: [{ functionCall: { name: 'noop_test_tool', args: { n: callCount } } }] } }],
                    usageMetadata: undefined,
                },
            } as unknown as Awaited<ReturnType<typeof AI.generateContent>>;
        });

        await agent.execute('Task', {
            conversationMode: 'boardroom',
            boardroomDispatchPlan: {
                type: 'BOARDROOM_DISPATCH_PLAN',
                code: 'BOARDROOM_DISPATCH_READY',
                executedAgentIds: ['generalist'],
                deferredAgentIds: [],
                maxIterationsPerAgent: 2,
                nextContinuationAgentId: null,
                leaseId: '33333333-3333-4333-8333-333333333333',
                leaseExpiresAtMs: Date.now() + 60_000,
                sideEffectOwnerAgentId: 'generalist',
            },
        });

        expect(aiMock.AutonomousIntelligence.generateContent).toHaveBeenCalledTimes(2);
        expect(vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls[0]?.[5]).toMatchObject({
            boardroomDispatchLeaseId: '33333333-3333-4333-8333-333333333333',
            boardroomAgentId: 'generalist',
        });
        expect(JSON.stringify(vi.mocked(aiMock.AutonomousIntelligence.generateContent).mock.calls[1]?.[0]))
            .toContain('[SYSTEM — FINAL STEP]');
    });

    it('preserves a completed image tool result when only the typed capacity summary turn is rejected', async () => {
        const agent = new BaseAgent({ ...baseConfig, authorizedTools: ['generate_image'] });
        const agentWithFunctions = agent as unknown as {
            functions: Record<string, () => Promise<{ success: boolean; message: string; data: { urls: string[] } }>>
        };
        agentWithFunctions.functions.generate_image = async () => ({
            success: true,
            message: 'Successfully generated 1 image. It is now in the Gallery.',
            data: { urls: ['https://storage.example/generated-dog.png'] },
        });

        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContentStream)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({
                    text: () => '',
                    functionCalls: () => [{ name: 'generate_image', args: { prompt: 'a happy dog' } }],
                }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>)
            .mockRejectedValueOnce(new AppException(
                AppErrorCode.GENERATION_CAPACITY_LIMITED,
                'Boardroom is temporarily at capacity. Your request was not sent for generation.',
                { retryable: true, retryAfterMs: 60_000, context: { providerSubmitted: false } },
            ));

        const response = await agent.execute('Make an image of a happy dog');

        expect(response.text).toBe('Successfully generated 1 image. It is now in the Gallery.');
        expect(response.error).toBeUndefined();
        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls?.[0]?.result).toMatchObject({ success: true });
        expect(aiMock.AutonomousIntelligence.generateContentStream).toHaveBeenCalledTimes(2);
        expect(aiMock.AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });

    it('preserves a completed image tool result when the later summary turn loses the network', async () => {
        const agent = new BaseAgent(baseConfig);
        const imageTool = vi.fn(async () => ({
            success: true,
            message: 'Successfully generated 1 image. It is now in the Gallery.',
            data: { urls: ['https://storage.example/generated-dog.png'] },
        }));
        (agent as unknown as { functions: Record<string, typeof imageTool> }).functions.generate_image = imageTool;
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContentStream)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({
                    text: () => '',
                    functionCalls: () => [{ name: 'generate_image', args: { prompt: 'a happy dog' } }],
                }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>)
            .mockRejectedValueOnce(new AppException(AppErrorCode.NETWORK_ERROR, 'Summary connection lost.'));

        const response = await agent.execute('Make an image of a happy dog');

        expect(response.text).toBe('Successfully generated 1 image. It is now in the Gallery.');
        expect(response.error).toBeUndefined();
        expect(imageTool).toHaveBeenCalledTimes(1);
        expect(aiMock.AutonomousIntelligence.generateContentStream).toHaveBeenCalledTimes(2);
    });

    it('keeps a non-owner Boardroom participant advisory and never invokes the image tool', async () => {
        const advisoryAgent = new BaseAgent({ ...baseConfig, id: 'creative' });
        const imageTool = vi.fn(async () => ({ success: true, message: 'must not run' }));
        (advisoryAgent as unknown as { functions: Record<string, typeof imageTool> }).functions.generate_image = imageTool;
        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContentStream).mockResolvedValueOnce({
            stream: new ReadableStream({ start(controller) { controller.close(); } }),
            response: Promise.resolve({
                text: () => '',
                functionCalls: () => [{ name: 'generate_image', args: { prompt: 'a happy dog' } }],
            }),
        } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>);

        const response = await advisoryAgent.execute('Make an image of a happy dog', {
            conversationMode: 'boardroom',
            boardroomDispatchPlan: {
                type: 'BOARDROOM_DISPATCH_PLAN',
                code: 'BOARDROOM_DISPATCH_READY',
                executedAgentIds: ['generalist', 'creative'],
                deferredAgentIds: [],
                maxIterationsPerAgent: 2,
                nextContinuationAgentId: null,
                leaseId: '45454545-4545-4454-8454-454545454545',
                leaseExpiresAtMs: Date.now() + 60_000,
                sideEffectOwnerAgentId: 'generalist',
            },
        });

        expect(response).toMatchObject({
            error: 'BOARDROOM_SIDE_EFFECT_OWNER_MISMATCH',
            text: 'This participant remained advisory. No generation request was submitted.',
        });
        expect(imageTool).not.toHaveBeenCalled();
        expect(aiMock.AutonomousIntelligence.generateContentStream).toHaveBeenCalledTimes(1);
    });

    it('preserves a typed image-tool failure when the summary turn hits the legacy limiter response', async () => {
        const agent = new BaseAgent({ ...baseConfig, authorizedTools: ['generate_image'] });
        const agentWithFunctions = agent as unknown as {
            functions: Record<string, () => Promise<{ success: boolean; error: string; metadata: { errorCode: string } }>>
        };
        agentWithFunctions.functions.generate_image = async () => ({
            success: false,
            error: 'Internal provider and reservation details that must not be exposed.',
            metadata: { errorCode: 'GENERATION_CAPACITY_LIMITED' },
        });

        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContentStream)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({
                    text: () => '',
                    functionCalls: () => [{ name: 'generate_image', args: { prompt: 'a happy dog' } }],
                }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>)
            .mockRejectedValueOnce(new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Too many AI generation requests. Please retry shortly.',
            ));

        const response = await agent.execute('Make an image of a happy dog');

        expect(response).toMatchObject({
            text: 'Image generation is temporarily busy. Please wait about one minute and try again. No result was reported as completed.',
            error: 'GENERATION_CAPACITY_LIMITED',
        });
        expect(response.text).not.toContain('provider');
        expect(response.text).not.toContain('reservation');
        expect(aiMock.AutonomousIntelligence.generateContentStream).toHaveBeenCalledTimes(2);
        expect(aiMock.AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });

    it('propagates a typed capacity error after a non-image tool without exposing its raw result', async () => {
        const agent = new BaseAgent({ ...baseConfig, authorizedTools: ['calendar_lookup'] });
        const agentWithFunctions = agent as unknown as {
            functions: Record<string, () => Promise<{ success: boolean; message: string; data: { accessToken: string } }>>
        };
        agentWithFunctions.functions.calendar_lookup = async () => ({
            success: true,
            message: 'Raw calendar event details must not be returned here.',
            data: { accessToken: 'sensitive-tool-result' },
        });

        const aiMock = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        vi.mocked(aiMock.AutonomousIntelligence.generateContentStream)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({
                    text: () => '',
                    functionCalls: () => [{ name: 'calendar_lookup', args: { date: '2026-07-30' } }],
                }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>)
            .mockRejectedValueOnce(new AppException(
                AppErrorCode.GENERATION_CAPACITY_LIMITED,
                'Boardroom is temporarily at capacity. Your request was not sent for generation.',
                { retryable: true, retryAfterMs: 60_000, context: { providerSubmitted: false } },
            ));

        const response = await agent.execute('What is on my calendar?');

        expect(response).toMatchObject({
            text: 'Error: Boardroom is temporarily at capacity. Your request was not sent for generation.',
            error: 'Boardroom is temporarily at capacity. Your request was not sent for generation.',
        });
        expect(response.text).not.toContain('Raw calendar');
        expect(response.text).not.toContain('sensitive-tool-result');
        expect(response.toolCalls).toBeUndefined();
        expect(aiMock.AutonomousIntelligence.generateContentStream).toHaveBeenCalledTimes(2);
        expect(aiMock.AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });
});


// Structural orchestration checks: no provider calls or live audit writes.
describe('BaseAgent completion audit ordering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(AI.generateContent).mockReset();
        vi.mocked(AI.generateContentStream).mockReset();
        vi.mocked(recordToolOutcome).mockResolvedValue({ status: 'unavailable' });
    });

    it.each(['credential', 'memory', 'terminal'] as const)('audits a %s failure before returning its original outcome', async kind => {
        const toolResult: ToolFunctionResult = kind === 'memory'
            ? { success: false, error: 'Memory save could not be confirmed', metadata: { errorCode: 'MEMORY_SAVE_UNCONFIRMED' } }
            : kind === 'credential'
            ? { success: false, error: 'Credential bridge unavailable', metadata: { errorCode: 'CREDENTIAL_STORAGE_UNAVAILABLE' } }
            : { success: false, error: 'Delegation stopped', failure: { code: 'AGENT_EXECUTION_FAILED', retryable: false, agentId: 'generalist', recovery: 'review_failure' } };
        const agent = new BaseAgent({ id: 'generalist', name: 'Test', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'test', tools: [], authorizedTools: ['generate_image'] });
        const tool = vi.fn(async () => toolResult);
        (agent as unknown as { functions: Record<string, typeof tool> }).functions.generate_image = tool;
        vi.mocked(AI.generateContentStream).mockResolvedValueOnce({
            stream: new ReadableStream({ start(controller) { controller.close(); } }),
            response: Promise.resolve({ text: () => '', functionCalls: () => [{ name: 'generate_image', args: { prompt: 'test' } }] }),
        } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>);
        let acknowledge!: (receipt: { status: 'confirmed'; logId: string }) => void;
        const auditStarted = new Promise<void>(resolve => {
            vi.mocked(recordToolOutcome).mockImplementationOnce(() => {
                resolve();
                return new Promise(complete => { acknowledge = complete; });
            });
        });
        const finished = vi.fn();
        const pending = agent.execute('Make an image').then(response => { finished(response); return response; });
        await auditStarted;
        expect(finished).not.toHaveBeenCalled();
        expect(tool).toHaveBeenCalledTimes(1);
        expect(recordToolOutcome).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'generalist', toolName: 'generate_image', success: false, toolCallId: expect.any(String) }));
        acknowledge({ status: 'confirmed', logId: 'audit-id' });
        const response = await pending;
        expect(response.toolCalls?.[0]?.result).toMatchObject({ ...toolResult, metadata: { ...toolResult.metadata, audit: { status: 'confirmed', logId: 'audit-id' } } });
        expect(response.error).toBe(toolResult.error);
        expect(AI.generateContentStream).toHaveBeenCalledTimes(1);
    });
    it('keeps a successful action receipt when audit persistence is unconfirmed', async () => {
        const agent = new BaseAgent({ id: 'generalist', name: 'Test', description: 'Test', color: '#fff', category: 'specialist', systemPrompt: 'test', tools: [], authorizedTools: ['generate_image'] });
        const tool = vi.fn(async () => ({ success: true, message: 'Generated image saved.', data: { urls: ['https://example.test/image.png'] } }));
        (agent as unknown as { functions: Record<string, typeof tool> }).functions.generate_image = tool;
        vi.mocked(recordToolOutcome).mockResolvedValueOnce({ status: 'unconfirmed' });
        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({ text: () => '', functionCalls: () => [{ name: 'generate_image', args: { prompt: 'test' } }] }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>)
            .mockResolvedValueOnce({
                stream: new ReadableStream({ start(controller) { controller.close(); } }),
                response: Promise.resolve({ text: () => 'Generated image saved.', functionCalls: () => [] }),
            } as unknown as Awaited<ReturnType<typeof AI.generateContentStream>>);
        const response = await agent.execute('Make an image');
        expect(response.error).toBeUndefined();
        expect(response.toolCalls?.[0]?.result).toMatchObject({ success: true, message: 'Generated image saved.', data: { urls: ['https://example.test/image.png'] }, metadata: { audit: { status: 'unconfirmed' } } });
        expect(tool).toHaveBeenCalledTimes(1);
        expect(recordToolOutcome).toHaveBeenCalledTimes(1);
    });

});
