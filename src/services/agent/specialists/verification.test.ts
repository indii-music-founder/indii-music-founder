import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from '../registry';
import { agentService } from '../AgentService'; // Import to trigger registration
import { BrandAgent } from './BrandAgent';
import { RoadAgent } from './RoadAgent';
import { CampaignAgent } from './MarketingAgent';

// Mock dependencies to avoid full environment setup
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
            }
        })
    }
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => 'Mock Agent Response',
            functionCalls: () => []
        })
    }
}));

describe('Specialist Agent Verification', () => {
    // Manually register agents for the test
    agentRegistry.register(new BrandAgent());
    agentRegistry.register(new RoadAgent());
    agentRegistry.register(new CampaignAgent());

    it('should retrieve BrandAgent from registry', () => {
        const agent = agentRegistry.get('brand');
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(BrandAgent);
        expect(agent?.name).toBe('Brand Manager');
    });

    it('should retrieve RoadAgent from registry', () => {
        const agent = agentRegistry.get('road');
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(RoadAgent);
        expect(agent?.name).toBe('Road Manager');
    });

    it('should retrieve CampaignAgent from registry', () => {
        const agent = agentRegistry.get('campaign'); // Note: CampaignAgent ID is 'marketing' in the file, need to check
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(CampaignAgent);
        expect(agent?.name).toBe('Campaign Manager');
    });

    it('BrandAgent should have correct system prompt structure', () => {
        const agent = agentRegistry.get('brand') as BrandAgent;
        expect(agent.systemPrompt).toContain('Brand Manager');
        expect(agent.systemPrompt).toContain('Show Bible');
    });

    it('RoadAgent should have correct system prompt structure', () => {
        const agent = agentRegistry.get('road') as RoadAgent;
        expect(agent.systemPrompt).toContain('Road Manager');
        expect(agent.systemPrompt).toContain('logistics');
    });
});
