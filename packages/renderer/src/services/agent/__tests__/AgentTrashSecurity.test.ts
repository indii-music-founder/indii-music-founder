import { describe, it, expect } from 'vitest';
import { SUPERPOWER_TOOLS } from '../definitions/SuperpowerTools';
import { TOOL_RISK_REGISTRY } from '../ToolRiskRegistry';
import { TOOL_REGISTRY } from '../tools';

describe('Agent Trash Security & Tool Policy Compliance', () => {
    const FORBIDDEN_PURGE_PATTERNS = [
        'purge_trash',
        'empty_trash',
        'delete_permanently',
        'hard_delete',
        'purge_file',
        'delete_file_permanently',
    ];

    it('proves no superpower tool declares a permanent purge capability', () => {
        const toolNames = SUPERPOWER_TOOLS.map(t => t.name.toLowerCase());

        for (const pattern of FORBIDDEN_PURGE_PATTERNS) {
            const matches = toolNames.filter(name => name.includes(pattern));
            expect(matches, `Forbidden permanent purge tool '${pattern}' found in SUPERPOWER_TOOLS`).toEqual([]);
        }
    });

    it('proves TOOL_RISK_REGISTRY does not expose any permanent purge tool', () => {
        const registeredTools = Object.keys(TOOL_RISK_REGISTRY).map(t => t.toLowerCase());

        for (const pattern of FORBIDDEN_PURGE_PATTERNS) {
            const matches = registeredTools.filter(name => name.includes(pattern));
            expect(matches, `Forbidden permanent purge tool '${pattern}' found in TOOL_RISK_REGISTRY`).toEqual([]);
        }
    });

    it('verifies move_to_trash is registered as a reversible write operation', () => {
        const metadata = TOOL_RISK_REGISTRY['move_to_trash'];
        expect(metadata).toBeDefined();
        expect(metadata.riskTier).toBe('write');
        expect(metadata.requiresApproval).toBe(true);
    });

    it('verifies list_trash is registered as a read operation', () => {
        const metadata = TOOL_RISK_REGISTRY['list_trash'];
        expect(metadata).toBeDefined();
        expect(metadata.riskTier).toBe('read');
        expect(metadata.requiresApproval).toBe(false);
    });

    it('registers executable reversible Trash tools and no purge executor', () => {
        expect(TOOL_REGISTRY.list_trash).toBeTypeOf('function');
        expect(TOOL_REGISTRY.move_to_trash).toBeTypeOf('function');
        expect(TOOL_REGISTRY.restore_from_trash).toBeTypeOf('function');
        expect(TOOL_REGISTRY.purge_trash).toBeUndefined();
        expect(TOOL_REGISTRY.empty_trash).toBeUndefined();
        expect(TOOL_REGISTRY.delete_user_memory).toBeUndefined();
    });
});
