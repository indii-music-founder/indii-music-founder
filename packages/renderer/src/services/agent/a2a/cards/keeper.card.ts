import { AgentCard } from '../AgentCard.schema';

export const KeeperCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'keeper',
    displayName: 'Keeper Agent',
    description: 'Specialist for keeper operations.',
    capabilities: [
    {
        "name": "context_integrity",
        "description": "Context integrity",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "knowledge_retention",
        "description": "Knowledge retention",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "memory_indexing",
        "description": "Memory indexing",
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
