import { AgentCard } from '../AgentCard.schema';

export const LegalCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'legal',
    displayName: 'Legal Agent',
    description: 'Specialist for legal operations.',
    capabilities: [
    {
        "name": "analyze_contract",
        "description": "Analyze a legal contract for risks and provide a summary.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "draft_contract",
        "description": "Draft a new legal contract or agreement.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_nda",
        "description": "Rapidly generate a standard NDA.",
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
