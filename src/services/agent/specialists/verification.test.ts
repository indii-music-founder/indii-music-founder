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

    // Special check for Generalist (Agent Zero) since it's custom
    it('should verify GeneralistAgent (Agent Zero)', async () => {
        const agent = await agentRegistry.getAsync('generalist');
        expect(agent).toBeDefined();
        expect(agent?.name).toBe('Agent Zero');
    });
});

