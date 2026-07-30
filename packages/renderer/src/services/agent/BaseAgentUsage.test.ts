import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import { AgentConfig } from './types';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { importWithRetry } from '@/utils/dynamicImport';
import { AppErrorCode, AppException } from '@/shared/types/errors';

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

    it('preserves a completed image tool result when only the typed capacity summary turn is rejected', async () => {
        const agent = new BaseAgent(baseConfig);
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

    it('preserves a typed image-tool failure when the summary turn hits the legacy limiter response', async () => {
        const agent = new BaseAgent(baseConfig);
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
        const agent = new BaseAgent(baseConfig);
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
