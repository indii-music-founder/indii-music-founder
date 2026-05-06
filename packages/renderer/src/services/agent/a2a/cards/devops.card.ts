import { AgentCard } from '../AgentCard.schema';

export const DevopsCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'devops',
    displayName: 'Devops Agent',
    description: 'Specialist for devops operations.',
    capabilities: [
    {
        "name": "deployment_automation",
        "description": "Deployment automation",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "infrastructure_monitoring",
        "description": "Infrastructure monitoring",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "system_stability",
        "description": "System stability",
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
