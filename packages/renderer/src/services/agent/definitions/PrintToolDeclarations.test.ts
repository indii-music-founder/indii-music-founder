import { describe, expect, it } from 'vitest';
import { PRINT_MEDIA_PRESETS, getPrintPreset } from '@indii/shared';
import { PRINT_TOOL_DECLARATIONS } from './PrintToolDeclarations';
import { ToolPoolAssembler } from '../governance/ToolPoolAssembler';
import type { FunctionDeclaration } from '../types';
import creativeSource from './CreativeAgent.ts?raw';

describe('print tool schema exposure (structural checks)', () => {
    it('advertises only catalog presets and the actual distributor target', () => {
        const prepare = PRINT_TOOL_DECLARATIONS.find(tool => tool.name === 'prepare_print_file')!;
        expect(prepare.parameters.required).toEqual(['imageUri', 'presetId']);
        expect(prepare.parameters.properties.presetId!.enum).toEqual(PRINT_MEDIA_PRESETS.map(preset => preset.id));
        expect(prepare.parameters.properties.presetId!.enum).not.toContain('streaming_3000');
        const target = getPrintPreset('cover_art_distributor')!;
        expect([target.widthIn * target.dpi, target.heightIn * target.dpi, target.dpi]).toEqual([3000, 3000, 300]);
        expect(target.bleedIn ?? 0).toBe(0);
    });

    it('preserves print input and status schemas when a specialist exceeds the normal pool limit', () => {
        // Literal schemas exercise pure pool assembly, not an authenticated product journey.
        const otherDeclarations: FunctionDeclaration[] = Array.from({ length: 40 }, (_, index) => ({
            name: `specialist_tool_${index}`,
            description: 'Pure declaration for pool capacity coverage.',
            parameters: { type: 'OBJECT', properties: {} },
        }));
        const pool = ToolPoolAssembler.assemble([...otherDeclarations, ...PRINT_TOOL_DECLARATIONS], {
            agentId: 'creative', moduleContext: 'creative', conversationMode: 'department',
        });
        expect(pool.filter(tool => tool.name === 'prepare_print_file')).toEqual([PRINT_TOOL_DECLARATIONS[0]]);
        expect(pool.filter(tool => tool.name === 'get_print_job_status')).toEqual([PRINT_TOOL_DECLARATIONS[1]]);
        expect(PRINT_TOOL_DECLARATIONS[1]!.parameters.required).toEqual(['jobId']);
    });

    it('includes the shared print schemas in Creative specialist declarations', () => {
        // Source wiring only; successful live execution requires separate deployed UI evidence.
        const declarationSection = creativeSource.slice(creativeSource.indexOf('functionDeclarations: ['));
        expect(declarationSection).toContain('...PRINT_TOOL_DECLARATIONS,');
    });
});
