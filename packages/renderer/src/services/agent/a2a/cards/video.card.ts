import { AgentCard } from '../AgentCard.schema';

export const VideoCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'video',
    displayName: 'Video Agent',
    description: 'Specialist for video operations.',
    capabilities: [
    {
        "name": "generate_video",
        "description": "Generate a video from a text prompt or start image.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "batch_edit_videos",
        "description": "Edit/grade uploaded videos with an instruction.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "extend_video",
        "description": "Extend a video clip forwards or backwards.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "update_keyframe",
        "description": "Update animation keyframes.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Search for stock footage or visual references.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "indii_image_gen",
        "description": "Generate storyboard keyframes.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "orchestrate_timeline",
        "description": "Acts as a render supervisor, dynamically breaking down a master script/timeline into sequential 5-second descriptive prompts optimized for Veo generation.",
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
