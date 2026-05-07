import { AgentCard } from '../AgentCard.schema';

export const ScreenwriterCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'screenwriter',
    displayName: 'Screenwriter Agent',
    description: 'Specialist for screenwriter operations.',
    capabilities: [
    {
        "name": "format_screenplay",
        "description": "Format raw text into standard screenplay format.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_script_structure",
        "description": "Analyze the narrative structure of a script.",
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
