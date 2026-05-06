import { AgentCard } from '../AgentCard.schema';

export const FinanceTaxCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance.tax',
    displayName: 'Tax Worker',
    description: 'Tax and compliance specialist under the Finance department.',
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
    },
    roster: {
        category: 'specialist',
        departmentId: 'finance'
    }
};
