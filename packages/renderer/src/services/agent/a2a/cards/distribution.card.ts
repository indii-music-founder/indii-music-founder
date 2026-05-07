import { AgentCard } from '../AgentCard.schema';

export const DistributionCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'distribution',
    displayName: 'Distribution Agent',
    description: 'Specialist for distribution operations.',
    capabilities: [
    {
        "name": "prepare_release",
        "description": "Prepare a release for distribution by generating a DDEX ERN 4.3 message.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "run_audio_qc",
        "description": "Run audio quality control to detect fraud and verify Hi-Res/Atmos compliance.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "issue_isrc",
        "description": "Issue a new ISRC (International Standard Recording Code) for a track.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "certify_tax_profile",
        "description": "Guide a user through W-8BEN/W-9 tax certification and validate their TIN.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "calculate_payout",
        "description": "Calculate royalty distribution using waterfall logic (Fee → Recoup → Splits).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "run_metadata_qc",
        "description": "Run metadata quality control against Apple/Spotify style guides.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_bwarm",
        "description": "Generate MLC BWARM CSV for mechanical licensing registration with The MLC.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "check_merlin_status",
        "description": "Check Merlin Network compliance readiness for independent distribution.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "create_music_metadata",
        "description": "Highly advanced tool that analyzes audio and creates industry-standard 'Golden Metadata'. This metadata is DDEX-ready and includes AI-detected genre, mood, and identifiers.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "verify_metadata_golden",
        "description": "Verifies if a metadata object meets the industrial 'Golden Standard' (valid schema, splits sum to 100%).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "update_track_metadata",
        "description": "Updates specific fields in a track's metadata in the library.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Control the local browser to navigate websites (portals).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "pro_scraper",
        "description": "Scrape PRO repertories (ASCAP/BMI) for Chain of Title audits.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "payment_gate",
        "description": "Pause automation to request user approval for a fee.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Securely retrieve stored credentials for external services.",
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
