import { AgentCard } from '../AgentCard.schema';

export const MarketingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'marketing',
    displayName: 'Marketing Agent',
    description: 'Specialist for marketing operations.',
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
