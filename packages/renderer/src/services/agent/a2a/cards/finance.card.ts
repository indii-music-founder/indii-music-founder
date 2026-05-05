import { AgentCard } from '../AgentCard.schema';

export const FinanceCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance',
    displayName: 'Finance Agent',
    description: 'Specialist for finance operations.',
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
