import { AgentCard } from '../AgentCard.schema';

export const CreativeCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'creative',
    displayName: 'Creative Agent',
    description: 'Specialist for creative operations.',
    capabilities: [
    {
        "name": "art_direction",
        "description": "Art direction",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "visual_brainstorming",
        "description": "Visual brainstorming",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "design_execution",
        "description": "Design execution",
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
