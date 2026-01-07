import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentOrchestrator } from '../components/AgentOrchestrator';
import { AI } from '@/services/ai/AIService';
import { agentRegistry } from '../registry';
import { TraceService } from '../observability/TraceService';
import type { AgentContext } from '../types';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn()
    }
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        getAll: vi.fn()
    }
}));

vi.mock('../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn(),
        addStep: vi.fn(),
        completeTrace: vi.fn(),
        failTrace: vi.fn()
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    }
}));

// Mock agent list
const mockAgents = [
    { id: 'legal', name: 'Legal Agent', description: 'Handles contracts and legal documents' },
    { id: 'music', name: 'Music Agent', description: 'Audio analysis and production' },
    { id: 'video', name: 'Video Agent', description: 'Video editing and storyboards' },
    { id: 'marketing', name: 'Marketing Agent', description: 'Social media and campaigns' },
    { id: 'brand', name: 'Brand Agent', description: 'Brand guidelines and consistency' }
];

// Default context
const createMockContext = (overrides = {}): AgentContext => ({
    activeModule: 'dashboard',
    projectHandle: { name: 'Test Project', type: 'single' },
    ...overrides
} as AgentContext);

describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(agentRegistry.getAll).mockReturnValue(mockAgents as any);
        vi.mocked(TraceService.startTrace).mockResolvedValue('mock-trace-id');
        orchestrator = new AgentOrchestrator();
    });

    describe('determineAgent', () => {
        const mockRouting = (agentId: string, confidence = 1.0) => {
            vi.mocked(AI.generateContent).mockResolvedValue({
                text: () => JSON.stringify({
                    targetAgentId: agentId,
                    confidence,
                    reasoning: `Routing to ${agentId}`
                })
            } as any);
        };

        it('routes legal queries to LegalAgent', async () => {
            mockRouting('legal');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Draft a split sheet for my new collaboration'
            );

            expect(result).toBe('legal');
        });

        it('routes video queries to VideoAgent', async () => {
            mockRouting('video');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Create a storyboard for the music video'
            );

            expect(result).toBe('video');
        });

        it('routes music queries to MusicAgent', async () => {
            mockRouting('music');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Analyze the BPM and key of this track'
            );

            expect(result).toBe('music');
        });

        it('routes marketing queries to MarketingAgent', async () => {
            mockRouting('marketing');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Create a social media campaign for my album release'
            );

            expect(result).toBe('marketing');
        });

        it('falls back to GeneralistAgent for ambiguous queries', async () => {
            mockRouting('generalist');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'How do I use this app?'
            );

            expect(result).toBe('generalist');
        });

        it('falls back to generalist on AI error', async () => {
            vi.mocked(AI.generateContent).mockRejectedValue(new Error('API Error'));

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Some query'
            );

            expect(result).toBe('generalist');
        });

        it('falls back to generalist for invalid agent ID', async () => {
            mockRouting('invalid_agent_that_does_not_exist');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Some query'
            );

            expect(result).toBe('generalist');
        });

        it('handles empty response gracefully', async () => {
            vi.mocked(AI.generateContent).mockResolvedValue({
                text: () => ''
            } as any);

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Some query'
            );

            expect(result).toBe('generalist');
        });

        it('normalizes case in agent ID', async () => {
            mockRouting('LEGAL');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Review this contract'
            );

            expect(result).toBe('legal');
        });

        it('trims whitespace from agent ID', async () => {
            mockRouting('  video  ');

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Edit my video'
            );

            expect(result).toBe('video');
        });

        it('falls back to generalist on low confidence', async () => {
            mockRouting('legal', 0.5);

            const result = await orchestrator.determineAgent(
                createMockContext(),
                'Draft a contract maybe?'
            );

            expect(result).toBe('generalist');
        });

        it('passes context to AI prompt', async () => {
            mockRouting('music');

            await orchestrator.determineAgent(
                createMockContext({ activeModule: 'music', projectHandle: { name: 'My Album', type: 'album' } }),
                'Analyze this'
            );

            expect(AI.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: expect.objectContaining({
                        parts: expect.arrayContaining([
                            expect.objectContaining({
                                text: expect.stringContaining('My Album')
                            })
                        ])
                    })
                })
            );
        });

        it('includes user query in AI prompt', async () => {
            mockRouting('legal');

            await orchestrator.determineAgent(
                createMockContext(),
                'Draft a publishing contract'
            );

            expect(AI.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: expect.objectContaining({
                        parts: expect.arrayContaining([
                            expect.objectContaining({
                                text: expect.stringContaining('Draft a publishing contract')
                            })
                        ])
                    })
                })
            );
        });

        it('logs routing decision to trace', async () => {
            mockRouting('legal', 0.95);

            await orchestrator.determineAgent(
                createMockContext(),
                'Draft a contract'
            );

            expect(TraceService.addStep).toHaveBeenCalledWith(
                'mock-trace-id',
                'routing',
                expect.objectContaining({
                    selectedAgent: 'legal',
                    confidence: 0.95
                })
            );
        });
    });
});
