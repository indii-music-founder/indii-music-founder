import { AgentCard } from '../AgentCard.schema';

export const BrandCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'brand',
    displayName: 'Brand Agent',
    description: 'Specialist for brand operations.',
    capabilities: [
    {
        "name": "verify_output",
        "description": "Critique and verify generated content against a goal (Brand Bible).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_brand_consistency",
        "description": "Analyze content for tone, core values, and visual consistency.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_brand_guidelines",
        "description": "Generate structured brand guidelines based on core values.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "audit_visual_assets",
        "description": "Audit a list of visual assets for compliance.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_audio",
        "description": "Analyze an uploaded audio track for BPM, Key, Genre, and Vibe.",
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
