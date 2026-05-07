import { AgentCard } from '../AgentCard.schema';

export const DevopsCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'devops',
    displayName: 'Devops Agent',
    description: 'Specialist for devops operations.',
    capabilities: [
    {
        "name": "list_clusters",
        "description": "List all Google Kubernetes Engine (GKE) clusters and their basic status.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "get_cluster_status",
        "description": "Get detailed health status and alerts for a specific GKE cluster.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "scale_deployment",
        "description": "Scale a Kubernetes deployment to a specific number of replicas.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "list_instances",
        "description": "List all Google Compute Engine (GCE) VM instances.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "restart_service",
        "description": "Restart a specific service or application.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Access cloud consoles via browser if CLI fails.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Manage API keys and cloud secrets.",
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
