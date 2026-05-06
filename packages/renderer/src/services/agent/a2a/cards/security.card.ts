import { AgentCard } from '../AgentCard.schema';

export const SecurityCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'security',
    displayName: 'Security Agent',
    description: 'Specialist for security operations.',
    capabilities: [
    {
        "name": "risk_assessment",
        "description": "Risk assessment",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "threat_monitoring",
        "description": "Threat monitoring",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "vulnerability_scanning",
        "description": "Vulnerability scanning",
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
