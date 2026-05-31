const fs = require('fs');
const file = 'packages/renderer/src/services/agent/fine-tuned-models.ts';
let content = fs.readFileSync(file, 'utf8');

const patchStr = `
export function getFineTunedModel(agentId: ValidAgentId): string {
    const isE2E = process.env.NODE_ENV === 'test' || typeof window !== 'undefined' && window.location?.search.includes('e2e=true') || (typeof window !== 'undefined' && window.isFirebaseE2EMockEnabled) || (typeof process !== 'undefined' && process.env.VITE_PLAYWRIGHT_E2E === 'true');
    if (isE2E) {
        return 'gemini-3.1-flash-lite'; // E2E fallback
    }
`;

content = content.replace(/export function getFineTunedModel\(agentId: ValidAgentId\): string \{[\s\S]*?return 'gemini-2\.5-pro'; \/\/ E2E fallback\n    \}/, patchStr);
fs.writeFileSync(file, content);
