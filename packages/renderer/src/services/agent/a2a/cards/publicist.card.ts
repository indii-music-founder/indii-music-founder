import { AgentCard } from '../AgentCard.schema';

export const PublicistCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'publicist',
    displayName: 'Publicist Agent',
    description: 'Specialist for publicist operations.',
    capabilities: [
    {
        "name": "pr_outreach",
        "description": "PR outreach",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "press_release_writing",
        "description": "Press release writing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "media_relations",
        "description": "Media relations",
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
