import { AgentCard } from '../AgentCard.schema';

export const LegalCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'legal',
    displayName: 'Legal Agent',
    description: 'Specialist for legal operations.',
    capabilities: [
    {
        "name": "contract_review",
        "description": "Contract review",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "rights_management",
        "description": "Rights management",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "compliance_checking",
        "description": "Compliance checking",
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
