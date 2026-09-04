import { describe, it, expect } from 'vitest';
import { TOOL_RISK_REGISTRY, getToolRiskTier } from '../../ToolRiskRegistry';
import { CreativeAgent } from '../CreativeAgent';
import { VideoAgent } from '../VideoAgent';

describe('Editor Bridge Agent Wiring & Risk Registry (ISSUE-1416)', () => {
    describe('TOOL_RISK_REGISTRY configuration', () => {
        it('registers read-only video planning and discovery tools correctly', () => {
            const readTools = [
                'video_list_renderable_assets',
                'video_plan_sequence',
                'video_plan_chain',
                'video_get_render_status'
            ];

            for (const tool of readTools) {
                expect(TOOL_RISK_REGISTRY[tool]).toBeDefined();
                expect(TOOL_RISK_REGISTRY[tool].riskTier).toBe('read');
                expect(TOOL_RISK_REGISTRY[tool].requiresApproval).toBe(false);
                expect(getToolRiskTier(tool)).toBe('read');
            }
        });

        it('registers billable render tools as destructive requiring explicit user approval', () => {
            const billableTools = ['video_render_stitch', 'video_render_chain'];

            for (const tool of billableTools) {
                expect(TOOL_RISK_REGISTRY[tool]).toBeDefined();
                expect(TOOL_RISK_REGISTRY[tool].riskTier).toBe('destructive');
                expect(TOOL_RISK_REGISTRY[tool].requiresApproval).toBe(true);
                expect(getToolRiskTier(tool)).toBe('destructive');
            }
        });
    });

    describe('CreativeAgent wiring', () => {
        const expectedTools = [
            'video_list_renderable_assets',
            'video_plan_sequence',
            'video_plan_chain',
            'video_render_stitch',
            'video_render_chain',
            'video_get_render_status'
        ];

        it('authorizes all editor bridge tools', () => {
            for (const tool of expectedTools) {
                expect(CreativeAgent.authorizedTools).toContain(tool);
            }
        });

        it('maps all editor bridge tools to callable functions', () => {
            for (const tool of expectedTools) {
                expect(CreativeAgent.functions![tool]).toBeDefined();
                expect(typeof CreativeAgent.functions![tool]).toBe('function');
            }
        });

        it('declares function specifications in schema tools', () => {
            const declaredNames = CreativeAgent.tools?.[0]?.functionDeclarations?.map(f => f.name) ?? [];
            for (const tool of expectedTools) {
                expect(declaredNames).toContain(tool);
            }
        });
    });

    describe('VideoAgent wiring', () => {
        const expectedTools = [
            'video_list_renderable_assets',
            'video_plan_sequence',
            'video_plan_chain',
            'video_render_stitch',
            'video_render_chain',
            'video_get_render_status'
        ];

        it('authorizes all editor bridge tools', () => {
            for (const tool of expectedTools) {
                expect(VideoAgent.authorizedTools).toContain(tool);
            }
        });

        it('maps all editor bridge tools to callable functions', () => {
            for (const tool of expectedTools) {
                expect(VideoAgent.functions![tool]).toBeDefined();
                expect(typeof VideoAgent.functions![tool]).toBe('function');
            }
        });

        it('declares function specifications in schema tools', () => {
            const declaredNames = VideoAgent.tools?.[0]?.functionDeclarations?.map(f => f.name) ?? [];
            for (const tool of expectedTools) {
                expect(declaredNames).toContain(tool);
            }
        });
    });
});
