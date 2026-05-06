import { AgentCard } from '../AgentCard.schema';

export const LicensingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'licensing',
    displayName: 'Licensing Agent',
    description: 'Specialist for licensing operations.',
    capabilities: [
    {
        "name": "sync_licensing",
        "description": "Sync licensing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "clearance_processing",
        "description": "Clearance processing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "rights_negotiation",
        "description": "Rights negotiation",
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
