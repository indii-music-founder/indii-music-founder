import { AgentCard } from '@/services/agent/a2a/AgentCard.schema';

export const FinanceAccountingCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance.accounting',
    displayName: 'Accounting Worker',
    description: 'Ledger operations sub-specialist under the Finance department. Handles bookkeeping, expense categorization, and monthly close.',
    capabilities: [
        {
            name: 'categorize_expense',
            description: 'Classify a transaction (vendor, amount, memo) into a chart-of-accounts category for bookkeeping.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'reconcile_ledger',
            description: 'Match bank-feed transactions against booked entries and surface discrepancies.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'generate_pnl',
            description: 'Build a profit-and-loss statement for a given period from booked transactions.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'monthly_close',
            description: 'Run the monthly close workflow: reconcile, accrue, post adjusting entries, and freeze the period.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
    ],
    inputSchemas: {},
    outputSchemas: {},
    costModel: {
        perTokenInUsd: 0,
        perTokenOutUsd: 0,
    },
    riskTier: 'write',
    sla: {
        modeSync: {
            p50Ms: 2000,
            p99Ms: 5000,
        },
        modeStream: {
            firstByteMs: 500,
        },
    },
    roster: {
        category: 'specialist',
        departmentId: 'finance',
    },
};
