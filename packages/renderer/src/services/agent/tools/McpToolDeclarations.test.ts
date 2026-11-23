import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as declarations from './McpToolDeclarations';
import { BrandAgent } from '../definitions/BrandAgent';
import { CreativeAgent } from '../definitions/CreativeAgent';
import { DistributionAgent } from '../definitions/DistributionAgent';
import { FinanceAgent } from '../definitions/FinanceAgent';
import { LegalAgent } from '../definitions/LegalAgent';
import type { AgentConfig, FunctionDeclaration } from '../types';

const SERVER_TOOLS = resolve(__dirname, '../../../../../firebase/src/mcp/tools');

/** Extract top-level property names and required fields from a server tool's `inputSchema` literal. */
function serverSchema(file: string): { properties: string[]; required: string[] } {
    const source = readFileSync(resolve(SERVER_TOOLS, file), 'utf8');
    const start = source.indexOf('{', source.indexOf('inputSchema'));
    let depth = 0;
    let end = start;
    for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}' && --depth === 0) break;
    }
    const schema = source.slice(start + 1, end);
    const propsStart = schema.indexOf('{', schema.indexOf('properties'));
    depth = 0;
    let propsEnd = propsStart;
    const properties: string[] = [];
    let token = '';
    for (; propsEnd < schema.length; propsEnd++) {
        const ch = schema[propsEnd];
        if (ch === '{' || ch === '[') { depth++; token = ''; continue; }
        if (ch === '}' || ch === ']') { if (--depth === 0) break; token = ''; continue; }
        if (depth === 1 && ch === ':' && /^[A-Za-z]+$/.test(token.trim())) properties.push(token.trim());
        token = /[A-Za-z]/.test(ch) ? token + ch : (ch === ' ' || ch === '\n' ? token : '');
        if (ch === ',' ) token = '';
    }
    const rest = schema.slice(propsEnd + 1);
    const required = [...(rest.match(/required:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]!);
    return { properties: properties.sort(), required };
}

const CASES: Array<[FunctionDeclaration, string, AgentConfig]> = [
    [declarations.FETCH_BRAND_KIT_DECLARATION, 'fetchBrandKit.ts', BrandAgent],
    [declarations.QUEUE_RELEASE_CANVAS_RENDER_DECLARATION, 'queueReleaseCanvasRender.ts', CreativeAgent],
    [declarations.AUDIT_ASSET_RESOLUTIONS_DECLARATION, 'auditAssetResolutions.ts', CreativeAgent],
    [declarations.DRAFT_DSP_METADATA_DECLARATION, 'draftDspMetadata.ts', DistributionAgent],
    [declarations.CALCULATE_RECOUPMENT_DECLARATION, 'calculateRecoupment.ts', FinanceAgent],
    [declarations.STAGE_STRIPE_PAYOUTS_DECLARATION, 'stageStripePayouts.ts', FinanceAgent],
    [declarations.REGISTER_SPLIT_SHEET_DECLARATION, 'registerSplitSheet.ts', LegalAgent],
    [declarations.DRAFT_CWR_REGISTRATION_DECLARATION, 'draftCwrRegistration.ts', LegalAgent],
    [declarations.AUDIT_SAMPLE_CLEARANCE_DECLARATION, 'auditSampleClearance.ts', LegalAgent],
];

describe('MCP tool declarations match the server schemas (ISSUE-1709)', () => {
    it.each(CASES.map(([declaration, file, agent]) => [declaration.name, declaration, file, agent] as const))('%s', (_name, declaration, file, agent) => {
        const server = serverSchema(file);
        const params = declaration.parameters as { properties: Record<string, unknown>; required?: string[] };

        expect(Object.keys(params.properties).sort()).toEqual(server.properties);
        expect([...(params.required ?? [])].sort()).toEqual([...server.required].sort());

        const declared = (agent.tools ?? []).flatMap(tool => tool.functionDeclarations ?? []).map(d => d.name);
        expect(declared).toContain(declaration.name);
        expect(agent.functions?.[declaration.name]).toBeTypeOf('function');
    });
});
