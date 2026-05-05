import fs from 'fs';
import path from 'path';

const VALID_AGENT_IDS = [
    'marketing', 'legal', 'finance', 'producer', 'director', 'screenwriter', 'video',
    'social', 'publicist', 'road', 'creative', 'publishing', 'licensing', 'brand',
    'devops', 'security', 'merchandise', 'distribution', 'music', 'curriculum', 'keeper'
];

const dir = path.join(process.cwd(), 'packages/renderer/src/services/agent/a2a/cards');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

VALID_AGENT_IDS.forEach(id => {
    const className = id.charAt(0).toUpperCase() + id.slice(1) + 'Card';
    const content = `import { AgentCard } from '../AgentCard.schema';

export const ${className}: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: '${id}',
    displayName: '${id.charAt(0).toUpperCase() + id.slice(1)} Agent',
    description: 'Specialist for ${id} operations.',
    capabilities: [],
    inputSchemas: {},
    outputSchemas: {},
    costModel: {
        perTokenInUsd: 0,
        perTokenOutUsd: 0
    },
    riskTier: 'write',
    sla: {
        modeSync: {
            p50Ms: 2000,
            p99Ms: 5000
        },
        modeStream: {
            firstByteMs: 500
        }
    }
};
`;
    fs.writeFileSync(path.join(dir, `${id}.card.ts`), content);
});

console.log(`Generated ${VALID_AGENT_IDS.length} cards in ${dir}`);
