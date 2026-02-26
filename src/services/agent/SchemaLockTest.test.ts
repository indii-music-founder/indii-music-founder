
import { describe, it, expect } from 'vitest';
import { BrandAgent } from './definitions/BrandAgent';
import { freezeAgentConfig } from './FreezeDiagnostic';

describe('BrandAgent Schema Lock Proof', () => {
    it('should be frozen and not allow mutations', () => {
        // Ensure it's frozen
        freezeAgentConfig(BrandAgent);

        const brandConsistencyTool = BrandAgent.tools?.[0].functionDeclarations.find(f => f.name === 'analyze_brand_consistency');
        expect(brandConsistencyTool).toBeDefined();
        expect(Object.isFrozen(brandConsistencyTool)).toBe(true);
        expect(Object.isFrozen(brandConsistencyTool?.parameters)).toBe(true);
        expect(Object.isFrozen(brandConsistencyTool?.parameters?.required)).toBe(true);

        // Try to mutate it (should fail in strict mode, or just not work)
        try {
            (brandConsistencyTool!.parameters! as any).required = [];
        } catch (e) {
            console.log('[SchemaLockTest] Mutation caught (Expected):', (e as Error).message);
        }

        expect(brandConsistencyTool?.parameters?.required).toEqual(['content', 'type']);
    });

    it('should stay intact after AgentRegistry access', async () => {
        const { agentRegistry } = await import('./registry');
        const agent = await agentRegistry.getAsync('brand');
        expect(agent).toBeDefined();

        const tool2 = BrandAgent.tools?.[0].functionDeclarations.find(f => f.name === 'analyze_brand_consistency');
        expect(tool2?.parameters?.required).toEqual(['content', 'type']);
    });
});
