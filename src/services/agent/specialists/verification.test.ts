import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from '../registry';
// import { agentService } from '../AgentService'; // Not needed if we trust the singleton registry initialization in other tests
// However, AgentService constructor might ensure registry is populated if registry wasn't a singleton with auto-init?
// registry.ts does `export const agentRegistry = new AgentRegistry();` which calls init.
// So imports are enough.

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
    // Agents are already registered by the singleton pattern in registry.ts upon import

    it('should retrieve BrandAgent from registry', () => {
        const agent = agentRegistry.get('brand');
        expect(agent).toBeDefined();
        // expect(agent).toBeInstanceOf(BaseAgent); // Cannot check instance of generic easily without import
        expect(agent?.name).toBe('Brand Manager');
    });

    it('should retrieve RoadAgent from registry', () => {
        const agent = agentRegistry.get('road');
        expect(agent).toBeDefined();
        expect(agent?.name).toBe('Road Manager');
    });

    it('should retrieve MarketingAgent from registry', () => {
        const agent = agentRegistry.get('marketing'); // Was 'campaign' in old test, but config uses 'marketing'
        expect(agent).toBeDefined();
        expect(agent?.name).toBe('Marketing Department');
    });

    it('BrandAgent should have correct system prompt structure', () => {
        const agent = agentRegistry.get('brand');
        expect((agent as any).systemPrompt).toContain('Brand Manager');
        expect((agent as any).systemPrompt).toContain('Show Bible');
    });

    it('RoadAgent should have correct system prompt structure', () => {
        const agent = agentRegistry.get('road');
        expect((agent as any).systemPrompt).toContain('Road Manager');
        expect((agent as any).systemPrompt).toContain('logistics');
    });
});
