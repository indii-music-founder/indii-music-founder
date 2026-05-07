import { AgentCard } from '../AgentCard.schema';

export const RoadCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'road',
    displayName: 'Road Agent',
    description: 'Specialist for road operations.',
    capabilities: [
    {
        "name": "plan_tour_route",
        "description": "Plan an optimized route for a tour.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "calculate_tour_budget",
        "description": "Calculate estimated budget for a tour.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "create_project",
        "description": "Create a new tour or event project.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "search_knowledge",
        "description": "Research venue details, logistics, or travel info from the knowledge base.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "search_places",
        "description": "Search for real-world places (venues, hotels, stores) using Google Maps.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "get_place_details",
        "description": "Get details (address, phone, rating) for a specific place by ID.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "get_distance_matrix",
        "description": "Calculate driving distance and time between locations.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_social_post",
        "description": "Generate tour updates for social media.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Use a web browser for navigation, traffic checks, or venue research.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Retrieve passwords for booking portals securely.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_visa_checklist",
        "description": "Generates an automated documentation tracker for international touring requirements (e.g., P2 visas for US, Tier 5 for UK).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_itinerary",
        "description": "Generate a detailed day-by-day tour itinerary including travel, load-in, soundcheck, and show times.",
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
