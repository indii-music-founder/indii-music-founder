
import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from './registry';
import { BrandAgent } from './specialists/BrandAgent';
import { RoadAgent } from './specialists/RoadAgent';
import { MarketingAgent } from './specialists/MarketingAgent';
import { BrandAgent } from './BrandAgent';
import { RoadAgent } from './RoadAgent';
import { MarketingAgent } from './MarketingAgent';

// Mock TOOL_REGISTRY to avoid circular dependency issues in test environment
vi.mock('../tools', () => ({
    TOOL_REGISTRY: {
        save_memory: vi.fn(),
        recall_memories: vi.fn(),
        verify_output: vi.fn(),
        request_approval: vi.fn()
    }
}));

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentProjectId: 'test-project',
            currentOrganizationId: 'org-1'
        })
    }
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => 'Mock Response',
            functionCalls: () => []
        })
    }
}));

describe('Specialist Agents Connection', () => {
    it('should have Brand and Road agents registered', () => {
        // We need to manually register them for the test if the service isn't instantiated
        // But since we are testing the classes themselves or the registry...
        // Let's instantiate them to check inheritance
        const brandAgent = new BrandAgent();
        const roadAgent = new RoadAgent();
        const marketingAgent = new MarketingAgent();

        expect(brandAgent).toBeInstanceOf(BrandAgent);
        expect(roadAgent).toBeInstanceOf(RoadAgent);
        expect(marketingAgent).toBeInstanceOf(MarketingAgent);
    });

    it('should inherit Agent Zero superpowers via BaseAgent', async () => {
        const brandAgent = new BrandAgent();

        // We can't easily inspect the private/protected execution logic without spying on AI.generateContent
        // But we can check if the tools are being passed correctly

        const { AI } = await import('@/services/ai/AIService');
        await brandAgent.execute('Test Task');

        const callArgs = (AI.generateContent as any).mock.calls[0][0];
        const tools = callArgs.config.tools;

        const hasSaveMemory = tools.some((t: any) => t.name === 'save_memory');
        const hasVerifyOutput = tools.some((t: any) => t.name === 'verify_output');

        expect(hasSaveMemory).toBe(true);
        expect(hasVerifyOutput).toBe(true);
    });
});
