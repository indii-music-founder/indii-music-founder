import { AgentCard } from '../AgentCard.schema';

export const PublishingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'publishing',
    displayName: 'Publishing Agent',
    description: 'Specialist for publishing operations.',
    capabilities: [
    {
        "name": "catalog_management",
        "description": "Catalog management",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "pro_registration",
        "description": "PRO registration",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "royalty_tracking",
        "description": "Royalty tracking",
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
    }
};
