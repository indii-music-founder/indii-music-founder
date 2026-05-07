import { AgentCard } from '../AgentCard.schema';

export const FinanceCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance',
    displayName: 'Finance Agent',
    description: 'Specialist for finance operations.',
    capabilities: [
    {
        "name": "analyze_budget",
        "description": "Analyze a project budget and calculate the 'indiiOS Dividend' savings.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "audit_metadata",
        "description": "Check a track's compliance with the Golden File standard.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "search_knowledge",
        "description": "Search the internal knowledge base for financial data (e.g. 'Artist_Economics_Deep_Dive').",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_receipt",
        "description": "Extract data (vendor, date, amount, category) from a receipt image.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "audit_distribution",
        "description": "Audit a track's metadata for distribution readiness to a specific partner.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "credential_vault",
        "description": "Securely retrieve passwords for royalty portals or banks.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "payment_gate",
        "description": "Authorize payments for invoices or fees.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "browser_tool",
        "description": "Check exchange rates or tax information.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_tax_report",
        "description": "Generates a tax prep report (Schedule C) by calculating split waterfalls and flagging payouts over $600 for 1099 reporting.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "forecast_revenue",
        "description": "Forecast revenue and the indiiOS Dividend (fees saved vs. 20% external manager) over N months given current streams and growth rate.",
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
    },
    roster: {
        category: 'department',
        workerIds: ['finance.accounting', 'finance.tax', 'finance.royalty']
    }
};
