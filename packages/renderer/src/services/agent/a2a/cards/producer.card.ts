import { AgentCard } from '../AgentCard.schema';

export const ProducerCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'producer',
    displayName: 'Producer Agent',
    description: 'Specialist for producer operations.',
    capabilities: [
    {
        "name": "beat_making",
        "description": "Beat making",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "arrangement_planning",
        "description": "Arrangement planning",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "mix_review",
        "description": "Mix review",
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
