import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentRegistry } from '../registry';
import { AGENT_CONFIGS } from '../agentConfig';
import { AI } from '@/services/ai/AIService';

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
                bio: 'Test Artist'
            },
            agentHistory: [],
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn()
        })
    }
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => 'Mock Agent Response',
            functionCalls: () => []
        }),
        // Ensure generateContentStream is also mocked if agents use it
        generateContentStream: vi.fn().mockImplementation(() => {
            return Promise.resolve({
                getReader: () => ({
                    read: async () => ({ done: true, value: undefined })
                })
            });
        })
    }
}));

describe('Specialist Agent Fleet Verification', () => {

    // Verify every agent defined in config is actually registered
    AGENT_CONFIGS.forEach(config => {
        it(`should have registered ${config.name} (${config.id})`, () => {
            const agent = agentRegistry.get(config.id);
            expect(agent).toBeDefined();
            expect(agent?.name).toBe(config.name);
            expect(agent?.id).toBe(config.id);
        });

        it(`${config.name} should be executable`, async () => {
            const agent = agentRegistry.get(config.id);
            expect(agent).toBeDefined();
            if (!agent) return;

            // Execute a dummy task
            const response = await agent.execute('Test execution task', {});

            // Should return valid structure
            expect(response).toBeDefined();
            expect(response.text).toBeDefined();
            // Since we mocked AI, we expect the mock response
            // Note: BaseAgents returning plain text directly from AI might just return the text
            // or the object depending on implementation. BaseAgent.ts usually returns { text: ... }
            if (typeof response === 'string') {
                expect(response).toBeTruthy();
            } else {
                expect(response.text).toBeTruthy();
            }
        });
    });

    // Special check for Generalist (Agent Zero) since it's custom
    it('should verify GeneralistAgent (Agent Zero)', async () => {
        const agent = agentRegistry.get('generalist');
        expect(agent).toBeDefined();
        // We know generalist mock stream behaves differently in its own test, 
        // but here we just want to ensure it doesn't crash on instantiation.
        expect(agent?.name).toBe('Agent Zero');
    });
});

