
import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from '../registry';

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
    it('should have Brand, Road, and Marketing agents registered', () => {
        const brandAgent = agentRegistry.get('brand');
        const roadAgent = agentRegistry.get('road');
        const marketingAgent = agentRegistry.get('marketing');

        expect(brandAgent).toBeDefined();
        expect(brandAgent?.id).toBe('brand');

        expect(roadAgent).toBeDefined();
        expect(roadAgent?.id).toBe('road');

        expect(marketingAgent).toBeDefined();
        expect(marketingAgent?.id).toBe('marketing');
    });

    it('should inherit Agent Zero superpowers via BaseAgent', async () => {
        const brandAgent = agentRegistry.get('brand');
        if (!brandAgent) throw new Error('Brand agent not found');

        // We can't easily inspect the private/protected execution logic without spying on AI.generateContent
        // But we can check if the tools are being passed correctly

        const { AI } = await import('@/services/ai/AIService');
        await brandAgent.execute('Test Task', {});

        const callArgs = (AI.generateContent as any).mock.calls[0][0];
        const tools = callArgs.tools;

        // Create a flat list of all function declarations from all tool objects
        const allFunctionDeclarations = tools.flatMap((t: any) => t.functionDeclarations || []);

        const hasSaveMemory = allFunctionDeclarations.some((f: any) => f.name === 'save_memory');
        const hasVerifyOutput = allFunctionDeclarations.some((f: any) => f.name === 'verify_output');

        expect(hasSaveMemory).toBe(true);
        expect(hasVerifyOutput).toBe(true);
    });
});
