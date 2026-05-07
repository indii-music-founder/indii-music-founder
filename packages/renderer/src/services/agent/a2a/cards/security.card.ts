import { AgentCard } from '../AgentCard.schema';

export const SecurityCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'security',
    displayName: 'Security Agent',
    description: 'Specialist for security operations.',
    capabilities: [
    {
        "name": "audit_permissions",
        "description": "Audit permissions for a specific user to detect risks.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "check_api_status",
        "description": "Checks the status of a managed API gateway (Apigee).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "scan_content",
        "description": "Scans text content for sensitive data or safety violations (Model Armor).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "rotate_credentials",
        "description": "Rotates access keys or credentials for a specific service.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Scan URLs for threats or verify SSL certificates.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Manage the secure vault (Store/Retrieve).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "scan_for_vulnerabilities",
        "description": "Scan a target system, URL, or API for potential security vulnerabilities.",
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
