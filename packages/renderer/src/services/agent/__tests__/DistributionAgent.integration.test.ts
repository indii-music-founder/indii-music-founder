import { describe, it, expect, beforeAll } from 'vitest';
import { agentRegistry } from '../registry';

describe('DistributionAgent Integration', () => {
    let distributionAgent: any;

    beforeAll(async () => {
        // Load the Distribution Agent asynchronously
        distributionAgent = await agentRegistry.getAsync('distribution');
    });

    it('should load Distribution Agent from registry', () => {
        expect(distributionAgent).toBeDefined();
        expect(distributionAgent.id).toBe('distribution');
        expect(distributionAgent.name).toBe('Distribution Chief');
    });

    it('should have all distribution tools declared', () => {
        expect(distributionAgent.tools).toBeDefined();
        expect(distributionAgent.tools.length).toBeGreaterThan(0);

        const toolDeclarations = distributionAgent.tools[0]?.functionDeclarations || [];
        const toolNames = toolDeclarations.map((t: any) => t.name);

        // Verify all tools are present
        expect(toolNames).toContain('prepare_release');
        expect(toolNames).toContain('run_audio_qc');
        expect(toolNames).toContain('issue_isrc');
        expect(toolNames).toContain('certify_tax_profile');
        expect(toolNames).toContain('calculate_payout');
        expect(toolNames).toContain('run_metadata_qc');
        expect(toolNames).toContain('generate_bwarm');
        expect(toolNames).toContain('check_merlin_status');

        expect(toolNames).toContain('browser_tool');
        expect(toolNames).toContain('pro_scraper');
        expect(toolNames).toContain('payment_gate');
        expect(toolNames).toContain('credential_vault');

        expect(toolNames.length).toBe(15);
    });

    it('should have proper tool schemas for new tools', () => {
        const toolDeclarations = distributionAgent.tools[0]?.functionDeclarations || [];

        const bwarmTool = toolDeclarations.find((t: any) => t.name === 'generate_bwarm');
        expect(bwarmTool).toBeDefined();
        expect(bwarmTool.parameters.properties.works).toBeDefined();
        expect(bwarmTool.parameters.properties.works.type).toBe('ARRAY');

        const merlinTool = toolDeclarations.find((t: any) => t.name === 'check_merlin_status');
        expect(merlinTool).toBeDefined();
        expect(merlinTool.parameters.properties.total_tracks).toBeDefined();
        expect(merlinTool.parameters.properties.has_isrcs).toBeDefined();
    });

    it('should have execute method', () => {
        expect(distributionAgent.execute).toBeDefined();
        expect(typeof distributionAgent.execute).toBe('function');
    });

    it('should have correct category and color', () => {
        expect(distributionAgent.category).toBe('department');
        expect(distributionAgent.color).toBe('bg-indigo-600');
    });

    it('should have comprehensive system prompt', () => {
        expect(distributionAgent.systemPrompt).toBeDefined();
        expect(distributionAgent.systemPrompt).toContain('Distribution Chief');
        expect(distributionAgent.systemPrompt).toContain('DDEX ERN 4.3');
        expect(distributionAgent.systemPrompt).toContain('generate_bwarm');
        expect(distributionAgent.systemPrompt).toContain('check_merlin_status');
    });
});
