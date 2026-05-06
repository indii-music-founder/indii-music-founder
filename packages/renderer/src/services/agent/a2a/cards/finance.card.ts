import { AgentCard } from '../AgentCard.schema';

export const FinanceCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance',
    displayName: 'Finance Agent',
    description: 'Specialist for finance operations.',
    capabilities: [
    {
        "name": "financial_modeling",
        "description": "Financial modeling",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "revenue_tracking",
        "description": "Revenue tracking",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "budget_allocation",
        "description": "Budget allocation",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    }
],
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
        category: 'department',
        workerIds: ['finance.accounting', 'finance.tax', 'finance.royalty']
    }
};
