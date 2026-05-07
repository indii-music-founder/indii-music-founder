import { AgentCard } from '../AgentCard.schema';

export const LicensingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'licensing',
    displayName: 'Licensing Agent',
    description: 'Specialist for licensing operations.',
    capabilities: [
    {
        "name": "check_availability",
        "description": "Check if a piece of content is available for licensing. Can use a URL for deep analysis.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_contract",
        "description": "Analyze a licensing agreement using contract parsing tools.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "draft_license",
        "description": "Draft a new licensing agreement or contract.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Research Music Supervisors or Sync Libraries.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "document_query",
        "description": "Analyze license agreements for unfair terms.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "payment_gate",
        "description": "Pay for clearance fees.",
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
