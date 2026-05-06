import { AgentCard } from '../AgentCard.schema';

export const DistributionCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'distribution',
    displayName: 'Distribution Agent',
    description: 'Specialist for distribution operations.',
    capabilities: [
    {
        "name": "dsp_distribution",
        "description": "DSP distribution",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "release_management",
        "description": "Release management",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "metadata_validation",
        "description": "Metadata validation",
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
