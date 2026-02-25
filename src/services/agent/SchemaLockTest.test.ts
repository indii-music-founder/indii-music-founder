
import { describe, it, expect } from 'vitest';
import { BrandAgent } from './definitions/BrandAgent';
import { freezeBrandAgent } from './FreezeDiagnostic';

describe('BrandAgent Schema Lock Proof', () => {
    it('should be frozen and not allow mutations', () => {
        // Ensure it's frozen
        freezeBrandAgent();

        const tool = BrandAgent.tools?.[0].functionDeclarations.find(f => f.name === 'analyze_brand_consistency');
        expect(tool).toBeDefined();
        expect(Object.isFrozen(tool)).toBe(true);
        expect(Object.isFrozen(tool?.parameters)).toBe(true);
        expect(Object.isFrozen(tool?.parameters?.required)).toBe(true);

        // Try to mutate it (should fail in strict mode, or just not work)
        try {
            (tool!.parameters! as any).required = [];
        } catch (e) {
            console.log('[SchemaLockTest] Mutation caught (Expected):', (e as Error).message);
        }

        expect(tool?.parameters?.required).toEqual(['content', 'type']);
    });

    it('should stay intact after AgentRegistry access', async () => {
        const { agentRegistry } = await import('./registry');
        const agent = await agentRegistry.getAsync('brand');
        expect(agent).toBeDefined();

        const tool = BrandAgent.tools?.[0].functionDeclarations.find(f => f.name === 'analyze_brand_consistency');
        expect(tool?.parameters?.required).toEqual(['content', 'type']);
    });
});
