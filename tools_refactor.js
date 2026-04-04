const fs = require('fs');
const file = 'src/services/agent/ToolRiskRegistry.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("import type { ToolRiskTier } from './types';", "import type { ToolRiskTier, ToolRiskMetadata } from './types';");
code = code.replace("export const TOOL_RISK_REGISTRY: Record<string, ToolRiskTier> =", "export const TOOL_RISK_REGISTRY: Record<string, ToolRiskMetadata> =");
code = code.replace(/([a-zA-Z0-9_]+):\s*'read',/g, "$1: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },");
code = code.replace(/([a-zA-Z0-9_]+):\s*'write',/g, "$1: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },");
code = code.replace(/([a-zA-Z0-9_]+):\s*'destructive',/g, "$1: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },");

const replacementEnd = `export function getToolRiskMetadata(toolName: string): ToolRiskMetadata {
    return TOOL_RISK_REGISTRY[toolName] ?? {
        riskTier: 'write',
        permissionTier: 'plugin',
        requiresApproval: true,
        description: 'Unknown tool implicitly treated as high-risk plugin'
    };
}

export function getToolRiskTier(toolName: string): ToolRiskTier {
    return getToolRiskMetadata(toolName).riskTier;
}`;

code = code.replace(/export function getToolRiskTier[\s\S]+$/, replacementEnd);
fs.writeFileSync(file, code);
