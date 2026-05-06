import { AgentCard } from '../AgentCard.schema';

export const BrandCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'brand',
    displayName: 'Brand Agent',
    description: 'Specialist for brand operations.',
    capabilities: [
    {
        "name": "brand_strategy",
        "description": "Brand strategy",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "identity_formulation",
        "description": "Identity formulation",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "voice_generation",
        "description": "Voice generation",
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
