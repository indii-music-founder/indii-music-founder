import { AgentCard } from '../AgentCard.schema';

export const KeeperCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'keeper',
    displayName: 'Keeper Agent',
    description: 'Specialist for keeper operations.',
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
