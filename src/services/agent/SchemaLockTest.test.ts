import { describe, it, expect } from 'vitest';
import { BrandAgent } from './definitions/BrandAgent';
import { AgentRegistry } from './AgentRegistry';

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
                tool.parameters.required.push('MUTATION_ATTEMPT');
            } catch (e) {
                // In strict mode, Object.freeze throws TypeError
            }

            expect(tool.parameters.required).not.toContain('MUTATION_ATTEMPT');
            expect(Object.isFrozen(tool.parameters.required)).toBe(true);
        }
    });

    it('should stay intact after AgentRegistry access', async () => {
        // Accessing via registry often triggers lazy loading/cloning logic
        const agent = await AgentRegistry.getAgent('brand');
        expect(agent).toBeDefined();

        const tool = agent?.tools?.[0]?.functionDeclarations?.find(f => f.name === 'analyze_brand_consistency');
        expect(tool?.parameters?.required).toContain('uploadedAudioIndex');

        // Ensure the registry didn't accidentally return a mutable copy that lost its freeze
        expect(Object.isFrozen(tool?.parameters?.required)).toBe(true);
    });
});
