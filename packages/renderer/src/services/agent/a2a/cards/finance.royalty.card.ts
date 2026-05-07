import { AgentCard } from '../AgentCard.schema';

export const FinanceRoyaltyCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'finance.royalty',
    displayName: 'Royalty Worker',
    description: 'Royalty distribution sub-specialist under the Finance department. Handles split waterfalls, statement generation, and recoupment tracking.',
    capabilities: [
        {
            name: 'compute_split_waterfall',
            description: 'Apply the configured split waterfall (advance recoupment, producer points, feature splits) to a payout amount.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'generate_royalty_statement',
            description: 'Produce a per-collaborator royalty statement for a period, itemized by release and revenue source.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'track_recoupment',
            description: 'Track outstanding advance recoupment balances per release and update them as revenue is booked.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'reconcile_dsr',
            description: 'Reconcile DSR (Digital Sales Report) line items against expected royalty splits and surface variances.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'classify_royalty_source',
            description: 'Tag incoming royalty income by source type (mechanical, performance, sync, neighboring rights) for downstream reporting.',
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
