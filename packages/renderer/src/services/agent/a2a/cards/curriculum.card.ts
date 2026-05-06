import { AgentCard } from '../AgentCard.schema';

export const CurriculumCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'curriculum',
    displayName: 'Curriculum Agent',
    description: 'Specialist for curriculum operations.',
    capabilities: [
    {
        "name": "educational_planning",
        "description": "Educational planning",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "learning_path_design",
        "description": "Learning path design",
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
