import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { GenAI } from '../../ai/GenAI';
import { StreamChunk } from '@/shared/types/ai.dto';
import { agentService } from '../AgentService';

vi.mock('../../ai/GenAI', () => ({
    GenAI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    }
}));

// Mock AgentService
vi.mock('../AgentService', () => ({
    agentService: {
        runAgent: vi.fn()
    }
}));

// Mock Firebase Auth
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    },
    db: {}
}));

// Mock MembershipService
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 100 })
    }
}));

// Mock useStore for BaseAgent
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'test-org',
            projects: []
        })),
        setState: vi.fn()
    }
}));

class ManagerAgent extends BaseAgent {
    constructor() {
        super({
            id: 'generalist',
            name: 'Manager',
            description: 'Agent for testing collaboration',
            systemPrompt: 'You are a manager.',
            category: 'manager',
            color: 'bg-blue-500',
            tools: [],
            functions: {}
        });
    }
}

describe('Agent Collaboration', () => {
    let agent: ManagerAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new ManagerAgent();
    });

    it('should delegate a task using delegate_task', async () => {
        const mockToolCallResponse = {
            response: {
                text: () => 'Delegating...',
                candidates: [{ content: { parts: [{ functionCall: { name: 'delegate_task', args: { targetAgentId: 'marketing', task: 'Create a plan' } } }] } }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        const mockFinalResponse = {
            response: {
                text: () => 'Here is the marketing plan.',
                candidates: [{ content: { parts: [{ text: 'Here is the marketing plan.' }] } }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        const generateContentSpy = (GenAI.generateContent as any);
        generateContentSpy
            .mockResolvedValueOnce(mockToolCallResponse) // 1. Decide to delegate
            .mockResolvedValueOnce(mockFinalResponse);   // 2. Report result

        // Mock the specialist response
        (agentService.runAgent as any).mockResolvedValue({
            text: 'Marketing plan content.'
        });

        const result = await agent.execute('Help with marketing', { traceId: 'parent-trace-123' });

        // Verify delegation call
        expect(agentService.runAgent).toHaveBeenCalledWith(
            'marketing',
            'Create a plan',
            expect.any(Object),
            'parent-trace-123',
            undefined
        );

        expect(result.text).toContain('marketing plan');
    });

    it('should consult multiple experts in parallel using consult_experts', async () => {
        const mockToolCallResponse = {
            response: {
                text: () => 'Consulting experts...',
                candidates: [{
                    content: {
                        parts: [{
                            functionCall: {
                                name: 'consult_experts',
                                args: {
                                    consultations: [
                                        { targetAgentId: 'producer', task: 'Analyze audio' },
                                        { targetAgentId: 'marketing', task: 'Draft tweet' }
                                    ]
                                }
                            }
                        }]
                    }
                }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        const mockFinalResponse = {
            response: {
                text: () => 'Experts have spoken.',
                candidates: [{ content: { parts: [{ text: 'Experts have spoken.' }] } }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        const generateContentSpy = (GenAI.generateContent as any);
        generateContentSpy
            .mockResolvedValueOnce(mockToolCallResponse)
            .mockResolvedValueOnce(mockFinalResponse);

        // Mock specialist responses
        (agentService.runAgent as any).mockImplementation(async (id: string) => {
            if (id === 'producer') return { text: 'Audio is fine.' };
            if (id === 'marketing') return { text: 'Tweet drafted.' };
            return { text: 'Unknown' };
        });

        const result = await agent.execute('Analyze and market this track', { traceId: 'main-trace' });

        // Verify parallel calls
        expect(agentService.runAgent).toHaveBeenCalledTimes(2);

        // Check results aggregation
        // consult_experts returns { success: true, data: { results }, message: ... }
        expect((result.data as any).success).toBe(true);
        const results = (result.data as any).data.results;
        expect(results).toHaveLength(2);
        expect(results[0].response.text).toBe('Audio is fine.');
        expect(results[1].response.text).toBe('Tweet drafted.');
    });
});
