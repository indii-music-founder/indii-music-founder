import { AgentCard } from '../AgentCard.schema';

export const MusicCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'music',
    displayName: 'Music Agent',
    description: 'Specialist for music operations.',
    capabilities: [
    {
        "name": "audio_analysis",
        "description": "Audio analysis",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "sonic_dna_extraction",
        "description": "Sonic DNA extraction",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "metadata_embedding",
        "description": "Metadata embedding",
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
