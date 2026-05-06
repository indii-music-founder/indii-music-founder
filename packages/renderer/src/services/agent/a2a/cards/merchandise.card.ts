import { AgentCard } from '../AgentCard.schema';

export const MerchandiseCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'merchandise',
    displayName: 'Merchandise Agent',
    description: 'Specialist for merchandise operations.',
    capabilities: [
    {
        "name": "product_design",
        "description": "Product design",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "supplier_logistics",
        "description": "Supplier logistics",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "store_management",
        "description": "Store management",
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
