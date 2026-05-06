import { AgentCard } from '../AgentCard.schema';

export const RoadCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'road',
    displayName: 'Road Agent',
    description: 'Specialist for road operations.',
    capabilities: [
    {
        "name": "tour_routing",
        "description": "Tour routing",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "logistics_planning",
        "description": "Logistics planning",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "booking_management",
        "description": "Booking management",
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
