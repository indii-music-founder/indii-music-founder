import { AgentCard } from '../AgentCard.schema';

export const ScreenwriterCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'screenwriter',
    displayName: 'Screenwriter Agent',
    description: 'Specialist for screenwriter operations.',
    capabilities: [
    {
        "name": "script_writing",
        "description": "Script writing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "dialogue_generation",
        "description": "Dialogue generation",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "narrative_arc_planning",
        "description": "Narrative arc planning",
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
