import { AgentCard } from '../AgentCard.schema';

export const LegalComplianceCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'legal.compliance',
    displayName: 'Compliance Worker',
    description: 'Regulatory and IP compliance sub-specialist under the Legal department. Handles trademark, copyright, and platform policy review.',
    capabilities: [
        {
            name: 'check_trademark_clearance',
            description: 'Search trademark registries for collisions on a proposed artist, release, or merchandise name.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'register_copyright',
            description: 'Prepare and file a copyright registration packet (eCO submission ready) for a sound recording or composition.',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'audit_platform_compliance',
            description: 'Audit a release or piece of content against DSP and social-platform policies (sample clearance, explicit flags, age-gating).',
            inputSchemaRef: '#/components/schemas/Empty',
            outputSchemaRef: '#/components/schemas/Empty',
            streaming: false,
        },
        {
            name: 'flag_legal_risk',
            description: 'Surface legal risk in user-generated material (uncleared samples, defamation exposure, right-of-publicity issues).',
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
    riskTier: 'read',
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
