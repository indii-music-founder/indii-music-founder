import { AgentCard } from '../AgentCard.schema';

export const DirectorCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'director',
    displayName: 'Director Agent',
    description: 'Specialist for director operations.',
    capabilities: [
    {
        "name": "video_direction",
        "description": "Video direction",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "storyboarding",
        "description": "Storyboarding",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "visual_narrative",
        "description": "Visual narrative",
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
