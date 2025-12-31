import { describe, it, expect } from 'vitest';
import { BrandAgent } from './definitions/BrandAgent';
import { MarketingAgent } from './definitions/MarketingAgent';

describe('Agent Definitions', () => {
    describe('BrandAgent', () => {
        it('should have the correct ID and name', () => {
            expect(BrandAgent.id).toBe('brand');
            expect(BrandAgent.name).toBe('Brand Manager');
        });

        it('should register required tools', () => {
            const toolNames = BrandAgent.tools?.flatMap(t => t.functionDeclarations.map(f => f.name));
            expect(toolNames).toContain('analyze_brand_consistency');
            expect(toolNames).toContain('generate_brand_guidelines');
            expect(toolNames).toContain('audit_visual_assets');
        });

        it('should have correct parameter schema for analyze_brand_consistency', () => {
            const tool = BrandAgent.tools?.flatMap(t => t.functionDeclarations).find(f => f.name === 'analyze_brand_consistency');
            expect(tool).toBeDefined();
            expect(tool?.parameters?.required).toEqual(expect.arrayContaining(['content', 'type']));
        });
    });

    describe('MarketingAgent', () => {
        it('should have the correct ID and name', () => {
            expect(MarketingAgent.id).toBe('marketing');
            expect(MarketingAgent.name).toBe('Marketing Department');
        });

        it('should register required tools', () => {
            const toolNames = MarketingAgent.tools?.flatMap(t => t.functionDeclarations.map(f => f.name));
            expect(toolNames).toContain('create_campaign_brief');
            expect(toolNames).toContain('analyze_audience');
            expect(toolNames).toContain('schedule_content');
            expect(toolNames).toContain('track_performance');
        });

        it('should have correct parameter schema for create_campaign_brief', () => {
            const tool = MarketingAgent.tools?.flatMap(t => t.functionDeclarations).find(f => f.name === 'create_campaign_brief');
            expect(tool).toBeDefined();
            expect(tool?.parameters?.required).toEqual(expect.arrayContaining(['product', 'goal']));
        });
    });
});
