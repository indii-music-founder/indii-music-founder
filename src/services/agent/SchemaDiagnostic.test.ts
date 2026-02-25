import { describe, it, expect } from 'vitest';
import { AGENT_CONFIGS } from './agentConfig';
import { BrandAgent } from './definitions/BrandAgent';

describe('Schema Diagnostic', () => {
    it('should have correct required parameters for BrandAgent in AGENT_CONFIGS', () => {
        const brandAgent = AGENT_CONFIGS.find(a => a.id === 'brand');
        const tool = brandAgent?.tools?.find(t => t.functionDeclarations.some(f => f.name === 'analyze_brand_consistency'));
        const declaration = tool?.functionDeclarations.find(f => f.name === 'analyze_brand_consistency');

        console.log('AGENT_CONFIGS BrandAgent required:', JSON.stringify(declaration?.parameters.required));
        expect(declaration?.parameters.required).toContain('content');
        expect(declaration?.parameters.required).toContain('type');
    });

    it('should have correct required parameters for direct BrandAgent import', () => {
        const tool = BrandAgent.tools?.find(t => t.functionDeclarations.some(f => f.name === 'analyze_brand_consistency'));
        const declaration = tool?.functionDeclarations.find(f => f.name === 'analyze_brand_consistency');

        console.log('Direct BrandAgent required:', JSON.stringify(declaration?.parameters.required));
        expect(declaration?.parameters.required).toContain('content');
        expect(declaration?.parameters.required).toContain('type');
    });
});
