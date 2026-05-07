import { AgentCard } from '../AgentCard.schema';

export const FinanceTaxCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance.tax',
    displayName: 'Tax Worker',
    description: 'Tax and compliance sub-specialist under the Finance department. Handles deduction tracking, 1099/W-2 prep, and quarterly estimates.',
    capabilities: [
        {
            name: 'track_deductions',
            description: 'Identify and tag tax-deductible expenses (gear, travel, studio time, education) from booked transactions.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'prepare_1099',
            description: 'Generate 1099-NEC forms for collaborators paid over $600 in a tax year, with TIN validation.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'estimate_quarterly_tax',
            description: 'Compute quarterly self-employment tax estimates based on YTD income and prior-year safe-harbor.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'schedule_c_export',
            description: 'Produce an IRS Schedule C-ready summary (gross receipts, COGS, expenses by line) for tax filing.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'flag_compliance_risk',
            description: 'Surface compliance risks (missing W-9s, mis-categorized contractor pay, state nexus triggers).',
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
