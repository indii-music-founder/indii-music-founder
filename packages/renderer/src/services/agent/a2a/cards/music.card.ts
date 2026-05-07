import { AgentCard } from '../AgentCard.schema';

export const MusicCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'music',
    displayName: 'Music Agent',
    description: 'Specialist for music operations.',
    capabilities: [
    {
        "name": "analyze_audio",
        "description": "Deep technical analysis of an uploaded audio file.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "create_music_metadata",
        "description": "Highly advanced tool that analyzes audio and creates industry-standard 'Golden Metadata'.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "update_track_metadata",
        "description": "Updates specific metadata fields for a track.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "verify_metadata_golden",
        "description": "Verifies if a metadata object meets the industrial 'Golden Standard'.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "scrub_id3_tags",
        "description": "Standardizes and cleans ID3 tags on an audio file.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "inject_splits_to_metadata",
        "description": "Injects royalty split data into track metadata.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "export_dolby_atmos_stems",
        "description": "Exports audio stems formatted for Dolby Atmos mixing.",
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
