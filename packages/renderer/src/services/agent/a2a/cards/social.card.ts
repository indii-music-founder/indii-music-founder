import { AgentCard } from '../AgentCard.schema';

export const SocialCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'social',
    displayName: 'Social Agent',
    description: 'Specialist for social operations.',
    capabilities: [
    {
        "name": "content_calendar_planning",
        "description": "Content calendar planning",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "platform_engagement",
        "description": "Platform engagement",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "copywriting",
        "description": "Copywriting",
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
