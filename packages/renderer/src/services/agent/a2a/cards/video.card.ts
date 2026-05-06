import { AgentCard } from '../AgentCard.schema';

export const VideoCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'video',
    displayName: 'Video Agent',
    description: 'Specialist for video operations.',
    capabilities: [
    {
        "name": "video_editing",
        "description": "Video editing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "vfx_review",
        "description": "VFX review",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "render_management",
        "description": "Render management",
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
