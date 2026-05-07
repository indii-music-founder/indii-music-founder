import { AgentCard } from '../AgentCard.schema';

export const PublishingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'publishing',
    displayName: 'Publishing Agent',
    description: 'Specialist for publishing operations.',
    capabilities: [
    {
        "name": "analyze_contract",
        "description": "Analyze a publishing contract.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "register_work",
        "description": "Register a new musical work with PROs.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "check_pro_catalog",
        "description": "Queries PROs (ASCAP/BMI) for existing catalog matches to prevent duplicate registration.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "package_release_assets",
        "description": "Definitively package audio and artwork for DDEX distribution.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "pro_scraper",
        "description": "Audit public repertories (ASCAP/BMI) for catalog accuracy.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "payment_gate",
        "description": "Authorize fees for song registration.",
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
