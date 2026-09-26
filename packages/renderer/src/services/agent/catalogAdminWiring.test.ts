import { describe, expect, it } from 'vitest';
import { TOOL_RISK_REGISTRY } from './ToolRiskRegistry';
import { DistributionAgent } from './definitions/DistributionAgent';
import { PublishingAgent } from './definitions/PublishingAgent';

/**
 * Post-Mastering Administrative Engine (P3) wiring contract:
 * the three catalog admin tools exist, are risk-classified per the
 * stage-only autonomy invariant, and are exposed on the Publishing and
 * Distribution agents (functions + authorizedTools + functionDeclarations).
 */
const TOOL_NAMES = ['catalog_query_gaps', 'catalog_stage_registration_payload', 'catalog_dispatch_split_invitations'] as const;

describe('CatalogAdminTools wiring contract', () => {
    it('classifies query as read/auto-approved and staging/dispatch as approval-gated writes', () => {
        expect(TOOL_RISK_REGISTRY.catalog_query_gaps).toMatchObject({
            riskTier: 'read', requiresApproval: false,
        });
        expect(TOOL_RISK_REGISTRY.catalog_stage_registration_payload).toMatchObject({
            riskTier: 'write', permissionTier: 'core', requiresApproval: true,
        });
        expect(TOOL_RISK_REGISTRY.catalog_dispatch_split_invitations).toMatchObject({
            riskTier: 'write', permissionTier: 'core', requiresApproval: true,
        });
    });

    it.each([
        ['DistributionAgent', DistributionAgent],
        ['PublishingAgent', PublishingAgent],
    ])('%s exposes all three tools in functions, authorizedTools, and declarations', (_name, agent) => {
        for (const toolName of TOOL_NAMES) {
            expect(typeof (agent.functions as Record<string, unknown>)[toolName]).toBe('function');
            expect(agent.authorizedTools).toContain(toolName);
        }
        const declarations = agent.tools[0]!.functionDeclarations as Array<{ name: string }>;
        const declared = new Set(declarations.map((declaration) => declaration.name));
        for (const toolName of TOOL_NAMES) {
            expect(declared).toContain(toolName);
        }
    });

    it('never marks a staging/dispatch tool as auto-approved (stage-only invariant)', () => {
        for (const toolName of ['catalog_stage_registration_payload', 'catalog_dispatch_split_invitations']) {
            expect(TOOL_RISK_REGISTRY[toolName]?.requiresApproval).toBe(true);
        }
    });
});
