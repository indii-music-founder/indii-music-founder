import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY } from '../tools';
import { AGENT_CONFIGS } from '../agentConfig';
import { BrandAgent } from '../definitions/BrandAgent';
import { MarketingAgent } from '../definitions/MarketingAgent';
import { RoadAgent } from '../definitions/RoadAgent';
import { SecurityAgent } from '../definitions/SecurityAgent';
import { PublicistAgent } from '../definitions/PublicistAgent';

describe('Agent System Verification', () => {

    // 1. Verify Agents are Enabled
    it('should have all specialist agents enabled in config', () => {
        const agentIds = AGENT_CONFIGS.map(a => a.id);
        expect(agentIds).toContain('brand');
        expect(agentIds).toContain('marketing');
        expect(agentIds).toContain('road');
        expect(agentIds).toContain('security');
        expect(agentIds).toContain('publicist');
    });

    // 2. Verify Brand Agent Tools
    it('should have Brand Agent tools registered', () => {
        // Check definition
        const toolNames = BrandAgent.tools.flatMap(t => t.functionDeclarations.map(f => f.name));
        // Note: definitions usually define what the LLM *sees*, registry contains the implementation.
        // We verify the implementation exists in registry.

        // BrandTools
        expect(TOOL_REGISTRY).toHaveProperty('analyze_brand_consistency');
        expect(TOOL_REGISTRY).toHaveProperty('generate_brand_guidelines');
        expect(TOOL_REGISTRY).toHaveProperty('audit_visual_assets');
    });

    // 3. Verify Marketing Agent Tools
    it('should have Marketing Agent tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('create_campaign_brief');
        expect(TOOL_REGISTRY).toHaveProperty('analyze_audience');
        expect(TOOL_REGISTRY).toHaveProperty('schedule_content');
        expect(TOOL_REGISTRY).toHaveProperty('track_performance');
    });

    // 4. Verify Road Agent Tools
    it('should have Road Agent tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('plan_tour_route');
        expect(TOOL_REGISTRY).toHaveProperty('calculate_tour_budget');
        expect(TOOL_REGISTRY).toHaveProperty('book_logistics');
        expect(TOOL_REGISTRY).toHaveProperty('generate_itinerary');
        expect(TOOL_REGISTRY).toHaveProperty('search_places'); // From MapsTools
    });

    // 5. Verify Security Agent Tools
    it('should have Security Agent tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('audit_permissions');
        expect(TOOL_REGISTRY).toHaveProperty('scan_for_vulnerabilities');
        expect(TOOL_REGISTRY).toHaveProperty('generate_security_report');
        expect(TOOL_REGISTRY).toHaveProperty('rotate_credentials');
    });

    // 6. Verify Publicist Agent Tools
    it('should have Publicist Agent tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('write_press_release');
        expect(TOOL_REGISTRY).toHaveProperty('generate_crisis_response');
        expect(TOOL_REGISTRY).toHaveProperty('manage_media_list');
        expect(TOOL_REGISTRY).toHaveProperty('pitch_story');
    });

    // 7. Test a Tool Execution (Mock)
    it('should execute a tool successfully', async () => {
        const result = await TOOL_REGISTRY['analyze_brand_consistency']({ content: "Test content", type: "Test" });
        const parsed = JSON.parse(result);
        expect(parsed.score).toBe(85);
    });
});
