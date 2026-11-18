import { describe, expect, it } from 'vitest';
import { ToolPoolAssembler } from '../ToolPoolAssembler';
import {
    READ_ONLY_DISCUSSION_ROSTER_TOOLS,
    TOOL_RISK_REGISTRY,
    isAllowedInReadOnlyDiscussion,
    resolveToolRiskMetadata,
} from '../../ToolRiskRegistry';

describe('read-only discussion roster exemption', () => {
    it('allows read tools and the Boardroom roster tools only', () => {
        expect(isAllowedInReadOnlyDiscussion('seat_agent', resolveToolRiskMetadata('seat_agent'))).toBe(true);
        expect(isAllowedInReadOnlyDiscussion('unseat_agent', resolveToolRiskMetadata('unseat_agent'))).toBe(true);
        expect(isAllowedInReadOnlyDiscussion('validate_metadata', resolveToolRiskMetadata('validate_metadata'))).toBe(true);
        for (const name of ['send_email', 'deploy_email_newsletter', 'register_work_with_pro', 'move_to_trash']) {
            expect(isAllowedInReadOnlyDiscussion(name, resolveToolRiskMetadata(name)), name).toBe(false);
        }
        expect(isAllowedInReadOnlyDiscussion('seat_agent', undefined)).toBe(false);
    });

    it('keeps the exemption to non-approval, non-destructive roster tools', () => {
        for (const name of READ_ONLY_DISCUSSION_ROSTER_TOOLS) {
            const meta = TOOL_RISK_REGISTRY[name];
            expect(meta, name).toBeDefined();
            expect(meta.riskTier, name).toBe('write');
            expect(meta.requiresApproval, name).toBe(false);
        }
    });

    it('offers seat/unseat to the Boardroom Conductor while withholding other write tools', () => {
        const declaration = (name: string) => ({ name, description: name, parameters: { type: 'OBJECT', properties: {} } });
        const conductorTools = ['seat_agent', 'unseat_agent', 'send_email', 'deploy_email_newsletter'].map(declaration);
        const names = ToolPoolAssembler.assemble(conductorTools as never, {
            agentId: 'generalist',
            moduleContext: 'boardroom',
            localToolNames: new Set(),
            isReadOnly: true,
            conversationMode: 'boardroom',
        }).map((tool) => tool.name);
        expect(names).toContain('seat_agent');
        expect(names).toContain('unseat_agent');
        expect(names).not.toContain('send_email');
        expect(names).not.toContain('deploy_email_newsletter');
        for (const name of names) {
            const meta = resolveToolRiskMetadata(name);
            expect(meta?.riskTier === 'read' || READ_ONLY_DISCUSSION_ROSTER_TOOLS.has(name), name).toBe(true);
        }
    });
});
