import { AgentCard } from '../AgentCard.schema';

export const ProducerCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'producer',
    displayName: 'Producer Agent',
    description: 'Specialist for producer operations.',
    capabilities: [
    {
        "name": "create_call_sheet",
        "description": "Generate a daily call sheet for the production.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "breakdown_script",
        "description": "Analyze a script for production requirements (props, costumes, etc).",
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
