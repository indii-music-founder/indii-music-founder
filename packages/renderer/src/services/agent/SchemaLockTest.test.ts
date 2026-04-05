import { describe, it, expect } from 'vitest';
import { BrandAgent } from './definitions/BrandAgent';
import { agentRegistry } from './registry';

describe('Agent Schema Lock Proof', () => {
    it('should be frozen and not allow mutations', () => {
        const agent = BrandAgent;

        // Attempt to mutate a deep property
        const tool = agent.tools?.[0]?.functionDeclarations?.find(f => f.name === 'analyze_brand_consistency');
        expect(tool).toBeDefined();

        if (tool && tool.parameters) {
            // This should throw in strict mode or simply not work
            try {
                // @ts-ignore - intentional mutation for test
                (tool.parameters as unknown as { required: string[] }).required.push('MUTATION_ATTEMPT');
            } catch (e: unknown) {
                // In strict mode, Object.freeze throws TypeError
            }

            expect(tool.parameters.required).not.toContain('MUTATION_ATTEMPT');
            expect(Object.isFrozen(tool.parameters.required)).toBe(true);
        }
    });

    it('should stay intact after AgentRegistry access', async () => {
        // Accessing via registry often triggers lazy loading/cloning logic
        const agent = (await agentRegistry.getAsync('brand')) as unknown as {
            tools?: { functionDeclarations?: { name: string, parameters?: { required: string[] } }[] }[];
            config?: { tools?: { functionDeclarations?: { name: string, parameters?: { required: string[] } }[] }[] };
        };
        expect(agent).toBeDefined();

        // Some agents might be wrapped in a class, some might be the raw config
        // We check for the tools schema in either location
        const tools = agent.tools || agent.config?.tools;
        const tool = tools?.[0]?.functionDeclarations?.find(f => f.name === 'analyze_brand_consistency');
        expect(tool?.parameters?.required).toContain('content');

        // Ensure the registry didn't accidentally return a mutable copy that lost its freeze
        expect(Object.isFrozen(tool?.parameters?.required)).toBe(true);
    });
});
