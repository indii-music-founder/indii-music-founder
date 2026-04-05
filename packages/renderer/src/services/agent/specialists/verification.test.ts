import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentRegistry } from '../registry';
import { AGENT_CONFIGS } from '../agentConfig';
import { GenAI as AI } from '@/services/ai/GenAI';

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 100, requiresApproval: false }),
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        getCurrentTier: vi.fn().mockResolvedValue('enterprise'),
        getLimits: vi.fn().mockReturnValue({ maxDailySpend: 100 }),
        getUpgradeMessage: vi.fn().mockReturnValue('Please upgrade')
    }
}));

// Mock GeminiRetrievalService to prevent real HTTP calls via RAGAgent
vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        query: vi.fn().mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{ text: 'NONE' }]
                }
            }]
        }),
        streamQuery: vi.fn(),
        uploadFile: vi.fn(),
        listFiles: vi.fn().mockResolvedValue({ files: [] }),
        ensureFileSearchStore: vi.fn().mockResolvedValue('fileSearchStores/mock-store'),
        importFileToStore: vi.fn(),
    },
    GeminiRetrievalService: vi.fn()
}));

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentProjectId: 'test-project',
            currentOrganizationId: 'org-1',
            userProfile: {
                brandKit: {
                    colors: ['#000000'],
                    fonts: 'Inter',
                    brandDescription: 'Minimalist',
                    releaseDetails: { title: 'Test Release', type: 'Single', mood: 'Dark' }
                },
                bio: 'Test Artist',
                email: 'test@example.com'
            },
            organizations: [{ id: 'org-1', plan: 'enterprise' }],
            agentHistory: [],
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn()
        }),
        setState: vi.fn()
    }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => 'Mock Agent Response',
                functionCalls: () => [],
                usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
                candidates: [{ content: { parts: [{ text: 'Mock Agent Response' }] } }]
            }
        }),
        generateContentStream: vi.fn().mockImplementation(async () => {
            return {
                stream: (async function* () {
                    yield { text: () => 'Mock' };
                    yield { text: () => ' Agent' };
                    yield { text: () => ' Response' };
                })(),
                response: Promise.resolve({
                    text: () => 'Mock Agent Response',
                    functionCalls: () => [],
                    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 }
                })
            };
        })
    }
}));

// Mock execution context to prevent Firestore operations during tests
vi.mock('../context/AgentExecutionContext', () => ({
    ExecutionContextFactory: {
        fromAgentContext: vi.fn().mockResolvedValue({
            hasUncommittedChanges: vi.fn().mockReturnValue(false),
            commit: vi.fn(),
            rollback: vi.fn(),
            getChangeSummary: vi.fn().mockReturnValue('')
        })
    }
}));

// Mock ContextManager to prevent import errors in history truncation
vi.mock('@/services/ai/context/ContextManager', () => ({
    ContextManager: {
        truncateContext: vi.fn().mockImplementation((history: any[]) => history)
    }
}));

// Mock ProactiveService
vi.mock('../ProactiveService', () => ({
    proactiveService: {
        scheduleTask: vi.fn().mockResolvedValue('mock-task-id'),
        subscribeToEvent: vi.fn().mockResolvedValue('mock-subscription-id')
    }
}));

// Mock events
vi.mock('@/core/events', () => ({
    events: {
        emit: vi.fn()
    }
}));

describe('Specialist Agent Fleet Verification', () => {

    // Verify every agent defined in config is actually registered
    AGENT_CONFIGS.forEach(config => {
        it(`should have registered ${config.name} (${config.id})`, async () => {
            const agent = await agentRegistry.getAsync(config.id);
            expect(agent).toBeDefined();
            expect(agent?.name).toBe(config.name);
            expect(agent?.id).toBe(config.id);
        });

        it(`${config.name} should be executable`, async () => {
            const agent = await agentRegistry.getAsync(config.id);
            expect(agent).toBeDefined();
            if (!agent) return;

            // Execute a dummy task
            const response = await agent.execute('Test execution task', {});

            // Should return valid structure
            expect(response).toBeDefined();
            expect(response.text).toBeDefined();

            if (typeof response === 'string') {
                expect(response).toBeTruthy();
            } else {
                expect(response.text).toBeTruthy();
            }
        });
    });

    // Special check for Generalist (indii Conductor) since it's custom
    it('should verify GeneralistAgent (indii Conductor)', async () => {
        const agent = await agentRegistry.getAsync('generalist');
        expect(agent).toBeDefined();
        expect(agent?.name).toBe('indii Conductor');
    });
});

