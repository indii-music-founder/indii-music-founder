
import { GeneralistAgent } from './GeneralistAgent';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContentStream: vi.fn()
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'test-org',
            currentProjectId: 'test-project',
            currentModule: 'dashboard',
            agentHistory: []
        }))
    }
}));

vi.mock('../tools', () => ({
    TOOL_REGISTRY: {
        propose_plan: vi.fn(async () => ({ success: true, message: 'Plan proposed' }))
    }
}));

describe('GeneralistAgent Living Plan Integration', () => {
    let agent: GeneralistAgent;

    beforeEach(() => {
        agent = new GeneralistAgent();
    });

    it('should include living plan tools in declarations', async () => {
        await agent.initialize();
        const tools = (agent as any).tools;
        const functionDeclarations = tools[0].functionDeclarations;
        
        const toolNames = functionDeclarations.map((f: any) => f.name);
        expect(toolNames).toContain('propose_plan');
        expect(toolNames).toContain('get_plan');
        expect(toolNames).toContain('refine_plan');
        expect(toolNames).toContain('cancel_plan');
        
        const proposePlan = functionDeclarations.find((f: any) => f.name === 'propose_plan');
        expect(proposePlan.parameters.properties.shape).toBeDefined();
        expect(proposePlan.parameters.properties.steps).toBeDefined();
    });
});
