import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import type { AgentConfig, AgentContext } from '@/services/agent/types';
import { VideoAgent } from '@/services/agent/definitions/VideoAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(),
    getApp: vi.fn(),
    getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({ currentUser: { uid: 'test-user-1' } })),
    initializeAuth: vi.fn(),
    browserLocalPersistence: {},
    browserSessionPersistence: {},
}));

const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockCollection = vi.fn((_db: unknown, path: string) => ({ path }));
const mockQuery = vi.fn((ref: unknown) => ref);

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    Timestamp: { now: vi.fn(() => ({ toMillis: () => Date.now() })), fromDate: vi.fn(), fromMillis: vi.fn() },
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: (db: unknown, path: string) => mockCollection(db, path),
    query: (ref: unknown) => mockQuery(ref),
    where: vi.fn(),
    limit: vi.fn(),
    getDocs: (q: unknown) => mockGetDocs(q),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
}));

vi.mock('@/services/firebase', () => ({
    app: {},
    db: {},
    auth: { currentUser: { uid: 'test-user-1' } },
    functions: {},
    storage: {},
    remoteConfig: {},
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        trackUsage: vi.fn().mockResolvedValue(true),
        recordSpend: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn(),
        getGenerativeModel: () => ({ generateContent: vi.fn() }),
    },
}));

vi.mock('@/services/agent/AgentIdentityService', () => ({
    AgentIdentityService: {
        getIdentityPrompt: vi.fn().mockResolvedValue(''),
    },
}));

vi.mock('@/services/agent/context/ContextRetrievalService', () => ({
    ContextRetrievalService: {
        retrieveContext: vi.fn().mockResolvedValue(''),
    },
}));

describe('ISSUE-1618: VideoAgent retrieval, solo specialist routing, and bounded failure recovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('queries users/{uid}/generated_videos instead of top-level generated_videos', async () => {
        const listFn = VideoAgent.functions?.list_domain_records;
        expect(listFn).toBeDefined();

        await listFn!({ collectionName: 'generated_videos', limit: 5 });
        expect(mockCollection).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^users\/[^/]+\/generated_videos$/));
    });

    it('respects solo specialist seat in handleBoardroomRequestFlow without reseating generalist', async () => {
        const { AgentService } = await import('@/services/agent/AgentService');
        const service = new AgentService();
        const addActiveAgent = vi.fn();
        const updateAgentMessage = vi.fn();
        const determineOrchestrationPath = vi.fn();
        const determineBoardroomIntent = vi.fn().mockResolvedValue('action');
        const executeAgent = vi.fn().mockResolvedValue({
            text: 'Video job queued.',
            data: null,
            toolCalls: [{ name: 'generate_video', args: { prompt: 'leaf' }, result: { success: true } }],
        });

        Object.assign(service as unknown as Record<string, unknown>, {
            getStore: vi.fn().mockResolvedValue({
                getState: () => ({
                    activeSessionId: 'sess-1',
                    activeAgents: ['video'],
                    uploadedImages: [],
                    referencedAssets: [],
                    generatedHistory: [],
                    agentHistory: [],
                    addActiveAgent,
                    updateAgentMessage,
                    addAgentMessage: vi.fn(),
                    addMessageToSession: vi.fn(),
                    appendAgentMessage: vi.fn(),
                }),
            }),
            orchestrator: {
                determineBoardroomIntent,
                determineOrchestrationPath,
            },
            executor: {
                execute: executeAgent,
            },
            flushSyncMessage: vi.fn(),
        });

        await (service as unknown as {
            handleBoardroomRequestFlow: (
                task: { rawUserUtterance: string; normalizedUtterance: string },
                attachments: undefined,
                context: AgentContext,
                responseId: string,
            ) => Promise<void>;
        }).handleBoardroomRequestFlow(
            { rawUserUtterance: 'Generate an 8-second 16:9 golden leaf video', normalizedUtterance: 'Generate an 8-second 16:9 golden leaf video' },
            undefined,
            { userId: 'test-user-1', orgId: 'org-1', userProfile: { id: 'test-user-1' } as never },
            'resp-1',
        );

        expect(determineOrchestrationPath).not.toHaveBeenCalled();
        expect(addActiveAgent).not.toHaveBeenCalledWith('generalist');
        expect(executeAgent).toHaveBeenCalledWith(
            'video',
            expect.any(String),
            expect.objectContaining({ seatedAgents: ['video'] }),
            expect.any(Function),
            undefined,
            undefined,
            undefined,
        );
    });

    it('ISSUE-1611: scopes stale chatHistory during delegated Boardroom steps so current request takes precedence', async () => {
        const { AgentService } = await import('@/services/agent/AgentService');
        const { AgentPromptBuilder } = await import('@/services/agent/builders/AgentPromptBuilder');
        const service = new AgentService();
        const executeAgent = vi.fn().mockResolvedValue({
            text: 'Generated image.',
            data: null,
            toolCalls: [{ name: 'indii_image_gen', args: { prompt: 'golden leaf' }, result: { success: true } }],
        });

        Object.assign(service as unknown as Record<string, unknown>, {
            getStore: vi.fn().mockResolvedValue({
                getState: () => ({
                    activeSessionId: 'sess-1',
                    activeAgents: ['generalist', 'creative'],
                    uploadedImages: [],
                    referencedAssets: [],
                    generatedHistory: [],
                    agentHistory: [],
                    addActiveAgent: vi.fn(),
                    updateAgentMessage: vi.fn(),
                    addAgentMessage: vi.fn(),
                    addMessageToSession: vi.fn(),
                    appendAgentMessage: vi.fn(),
                }),
            }),
            orchestrator: {
                determineBoardroomIntent: vi.fn().mockResolvedValue('action'),
                determineOrchestrationPath: vi.fn().mockResolvedValue({ type: 'single', agentId: 'creative' }),
            },
            executor: {
                execute: executeAgent,
            },
            flushSyncMessage: vi.fn(),
        });

        const longHistory = Array.from({ length: 12 }, (_, idx) => ({
            id: `msg-${idx}`,
            role: idx % 2 === 0 ? 'user' : 'model',
            text: `Historical 4k 3D render discussion turn ${idx}`,
            timestamp: idx,
        }));

        await (service as unknown as {
            handleBoardroomRequestFlow: (
                task: { rawUserUtterance: string; normalizedUtterance: string },
                attachments: undefined,
                context: AgentContext,
                responseId: string,
            ) => Promise<void>;
        }).handleBoardroomRequestFlow(
            {
                rawUserUtterance: 'Generate one square image of a single golden leaf on deep navy.',
                normalizedUtterance: 'Generate one square image of a single golden leaf on deep navy.',
            },
            undefined,
            {
                userId: 'test-user-1',
                orgId: 'org-1',
                userProfile: { id: 'test-user-1' } as never,
                chatHistory: longHistory as never,
                chatHistoryString: 'Huge stale 4k 3D render transcript',
            },
            'resp-1611',
        );

        const passedContext = executeAgent.mock.calls[0]?.[2] as AgentContext;
        expect(passedContext.chatHistory).toHaveLength(4);
        expect(passedContext.chatHistoryString).toBeUndefined();

        const prompt = AgentPromptBuilder.buildFullPrompt(
            'Creative prompt',
            'Generate one square image of a single golden leaf',
            'Creative Director',
            'creative',
            passedContext,
            {},
            'Historical 4k 3D render',
            '',
            '',
            '',
        );
        expect(prompt).toContain('# HISTORY (BACKGROUND CONTEXT ONLY');
        expect(prompt).toContain('# CURRENT OBJECTIVE (AUTHORITATIVE');
    });

    it('halts BaseAgent execution on repeated identical tool failure instead of looping', async () => {
        const failingTool = vi.fn().mockResolvedValue({
            success: false,
            error: 'Image generation failed: The generation request was rejected. Review the inputs and try again.',
            metadata: { errorCode: 'GENERATION_REJECTED' },
        });

        const config: AgentConfig = {
            id: 'video',
            name: 'Video Director',
            description: 'Video specialist',
            color: 'bg-blue-600',
            category: 'department',
            systemPrompt: 'Generate video.',
            authorizedTools: ['indii_image_gen'],
            functions: {
                indii_image_gen: failingTool,
            },
            tools: [{
                functionDeclarations: [{
                    name: 'indii_image_gen',
                    description: 'Generate image',
                    parameters: { type: 'OBJECT', properties: { prompt: { type: 'STRING' } } },
                }],
            }],
        };

        vi.mocked(AutonomousIntelligence.generateContent)
            .mockResolvedValueOnce({
                response: {
                    candidates: [{
                        content: {
                            parts: [{ functionCall: { name: 'indii_image_gen', args: { prompt: 'leaf 1' } } }],
                        },
                    }],
                },
            } as never)
            .mockResolvedValueOnce({
                response: {
                    candidates: [{
                        content: {
                            parts: [{ functionCall: { name: 'indii_image_gen', args: { prompt: 'leaf 2' } } }],
                        },
                    }],
                },
            } as never);

        const agent = new BaseAgent(config);
        const context: AgentContext = {
            userId: 'test-user-1',
            orgId: 'org-1',
        } as AgentContext;

        const result = await agent.execute('Generate a golden leaf video', context);

        expect(failingTool).toHaveBeenCalledTimes(2);
        expect(result.error).toContain('The generation request was rejected');
        expect(result.failure?.retryable).toBe(false);
    });
});
