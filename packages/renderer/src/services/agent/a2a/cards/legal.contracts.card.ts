import { AgentCard } from '../AgentCard.schema';

export const LegalContractsCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'legal.contracts',
    displayName: 'Contracts Worker',
    description: 'Contract drafting and review sub-specialist under the Legal department. Handles agreements, riders, and clause analysis.',
    capabilities: [
        {
            name: 'review_contract',
            description: 'Read a contract (recording, distribution, sync, work-for-hire) and surface unfavorable clauses, missing protections, and recoupment risks.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'draft_agreement',
            description: 'Draft a fresh agreement (split sheet, producer agreement, feature waiver) from a template + parameters.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'generate_rider',
            description: 'Produce a venue/tour rider with technical, hospitality, and financial requirements.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'redline_clauses',
            description: 'Suggest specific redline edits to bring a counterparty draft in line with artist-favorable terms.',
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
        departmentId: 'legal',
    },
};
