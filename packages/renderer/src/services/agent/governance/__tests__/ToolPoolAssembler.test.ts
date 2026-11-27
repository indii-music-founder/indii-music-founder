import { describe, it, expect } from 'vitest';
import { ToolPoolAssembler, sanitizeToolParameters } from '@/services/agent/governance/ToolPoolAssembler';
import { SUPERPOWER_TOOLS } from '@/services/agent/definitions/SuperpowerTools';
import { ToolParameters } from '@/services/agent/types';

describe('ToolPoolAssembler & Tool Schema Validation', () => {
    describe('SUPERPOWER_TOOLS Schema Compliance', () => {
        it('should have an items field on every ARRAY property across all superpower tools', () => {
            const malformedArrayProperties: Array<{ tool: string; property: string }> = [];

            for (const tool of SUPERPOWER_TOOLS) {
                if (!tool.parameters || !tool.parameters.properties) continue;
                for (const [propName, propSchema] of Object.entries(tool.parameters.properties)) {
                    const typeUpper = typeof propSchema.type === 'string' ? propSchema.type.toUpperCase() : '';
                    if (typeUpper === 'ARRAY' && !propSchema.items) {
                        malformedArrayProperties.push({ tool: tool.name, property: propName });
                    }
                }
            }

            expect(malformedArrayProperties).toEqual([]);
        });

        it('should ensure foundry_normalize_to_graph specifically defines items on rawRows', () => {
            const tool = SUPERPOWER_TOOLS.find(t => t.name === 'foundry_normalize_to_graph');
            expect(tool).toBeDefined();
            expect(tool?.parameters.properties.rawRows.type.toUpperCase()).toBe('ARRAY');
            expect(tool?.parameters.properties.rawRows.items).toBeDefined();
            expect(tool?.parameters.properties.rawRows.items?.type.toUpperCase()).toBe('OBJECT');
        });
    });

    describe('sanitizeToolParameters', () => {
        it('should inject a default items schema when an ARRAY parameter lacks one', () => {
            const malformed: ToolParameters = {
                type: 'OBJECT',
                properties: {
                    records: {
                        type: 'ARRAY',
                        description: 'A list of raw records',
                    },
                    name: {
                        type: 'STRING',
                    },
                },
                required: ['records'],
            };

            const sanitized = sanitizeToolParameters(malformed);
            expect(sanitized.properties.records.items).toBeDefined();
            expect(sanitized.properties.records.items?.type).toBe('OBJECT');
            expect(sanitized.properties.name.type).toBe('STRING');
        });

        it('should preserve existing items schemas without overwriting', () => {
            const valid: ToolParameters = {
                type: 'OBJECT',
                properties: {
                    tags: {
                        type: 'ARRAY',
                        items: { type: 'STRING', description: 'Tag string' },
                    },
                },
            };

            const sanitized = sanitizeToolParameters(valid);
            expect(sanitized.properties.tags.items?.type).toBe('STRING');
            expect(sanitized.properties.tags.items?.description).toBe('Tag string');
        });
    });

    describe('ToolPoolAssembler.assemble in Boardroom Read-Only mode', () => {
        it('should sanitize all assembled tools and exclude destructive actions', () => {
            const assembled = ToolPoolAssembler.assemble([], {
                agentId: 'generalist',
                moduleContext: 'boardroom',
                localToolNames: new Set(),
                isReadOnly: true,
                conversationMode: 'boardroom',
            });

            expect(assembled.length).toBeGreaterThan(0);

            // Confirm all array properties in assembled tools have items
            for (const tool of assembled) {
                if (!tool.parameters || !tool.parameters.properties) continue;
                for (const [propName, propSchema] of Object.entries(tool.parameters.properties)) {
                    const typeUpper = typeof propSchema.type === 'string' ? propSchema.type.toUpperCase() : '';
                    if (typeUpper === 'ARRAY') {
                        expect(propSchema.items, `Tool ${tool.name} property ${propName} must have items`).toBeDefined();
                    }
                }
            }
        });

        it('filters out unauthorized superpower tools when authorizedTools is specified while keeping trash recovery tools', () => {
            const assembled = ToolPoolAssembler.assemble([], {
                agentId: 'generalist',
                moduleContext: 'boardroom',
                localToolNames: new Set(['save_memory', 'recall_memories', 'audit_architecture', 'save_note', 'list_trash']),
                authorizedTools: ['save_memory', 'recall_memories'],
                isReadOnly: false,
                conversationMode: 'direct',
            });

            const names = assembled.map(t => t.name);
            expect(names).toContain('save_memory');
            expect(names).toContain('recall_memories');
            expect(names).toContain('list_trash');
            expect(names).not.toContain('audit_architecture');
            expect(names).not.toContain('save_note');
            expect(names).not.toContain('speak');
        });
    });
});
