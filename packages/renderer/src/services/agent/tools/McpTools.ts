import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { mcpClientService } from '../harness/McpClientService';
import type { AnyToolFunction } from '../types';

/**
 * Creates a generic wrapper for frontend Agent Builders to call a backend MCP tool.
 */
function createMcpWrapper(toolName: string) {
    return wrapTool(toolName, async (args: Record<string, unknown>) => {
        try {
            const result = await mcpClientService.executeTool(toolName, args);
            // Standardize the response format for the frontend chat. Remote tools
            // signal not-implemented/failed via isError — surface that as a tool
            // error so agents never treat a fail-closed stub as success.
            const { content, isError } = (result ?? {}) as { content?: unknown; isError?: boolean };
            if (isError) {
                const text = Array.isArray(content)
                    ? content.map(c => (c as { text?: string }).text ?? '').join('\n')
                    : String(content ?? 'Remote tool reported an error.');
                return toolError(text);
            }
            return toolSuccess(content ?? result, `Executed remote tool: ${toolName}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return toolError(`MCP execution failed: ${message}`);
        }
    });
}

/**
 * Front-end registry mapping for the backend MCP Server capabilities.
 * These are injected into the standard TOOL_REGISTRY so they can be 
 * invoked by the A2A Swarm as if they were local tools.
 */
export const McpTools: Record<string, AnyToolFunction> = {
    // ----------------------------------------------------
    // MARKETING (Publicist)
    // ----------------------------------------------------
    generate_playlist_pitch: createMcpWrapper('generate_playlist_pitch'),
    schedule_campaign_waterfall: createMcpWrapper('schedule_campaign_waterfall'),
    
    // ----------------------------------------------------
    // CREATIVE (Director)
    // ----------------------------------------------------
    fetch_brand_kit: createMcpWrapper('fetch_brand_kit'),
    queue_remotion_render: createMcpWrapper('queue_remotion_render'),
    audit_asset_resolutions: createMcpWrapper('audit_asset_resolutions'),

    // ----------------------------------------------------
    // LEGAL (Legal Agent)
    // ----------------------------------------------------
    register_split_sheet: createMcpWrapper('register_split_sheet'),
    draft_cwr_registration: createMcpWrapper('draft_cwr_registration'),
    audit_sample_clearance: createMcpWrapper('audit_sample_clearance'),

    // ----------------------------------------------------
    // FINANCE (Finance Agent)
    // ----------------------------------------------------
    calculate_recoupment: createMcpWrapper('calculate_recoupment'),
    stage_stripe_payouts: createMcpWrapper('stage_stripe_payouts'),

    // ----------------------------------------------------
    // DISTRIBUTION
    // ----------------------------------------------------
    draft_dsp_metadata: createMcpWrapper('draft_dsp_metadata')
};
