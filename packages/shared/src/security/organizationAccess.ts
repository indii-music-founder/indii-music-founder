export const ORGANIZATION_ROLES = ['owner', 'manager', 'producer', 'member'] as const;

export type OrganizationRole = typeof ORGANIZATION_ROLES[number];

export const ORGANIZATION_ACCESS_MODULES = [
    'agent',
    'analytics',
    'audio-analyzer',
    'brand',
    'campaign',
    'creative',
    'crm',
    'debug',
    'devops',
    'distribution',
    'files',
    'finance',
    'history',
    'knowledge',
    'legal',
    'licensing',
    'marketing',
    'marketplace',
    'memory',
    'merch',
    'notes',
    'observability',
    'publicist',
    'publishing',
    'registration',
    'road',
    'screenwriter',
    'security',
    'social',
    'workflow',
] as const;

export type OrganizationAccessModule = typeof ORGANIZATION_ACCESS_MODULES[number];

export interface OrganizationAccessRow {
    userId: string;
    displayName: string | null;
    email: string | null;
    role: OrganizationRole;
    allowedModules: OrganizationAccessModule[];
    source: 'owner' | 'explicit' | 'role-default';
    updatedAt: string | null;
}

export interface OrganizationAccessMatrix {
    orgId: string;
    canManage: boolean;
    viewerUserId: string;
    members: OrganizationAccessRow[];
}

export interface UpdateOrganizationAccessInput {
    orgId: string;
    targetUserId: string;
    role: Exclude<OrganizationRole, 'owner'>;
    allowedModules: OrganizationAccessModule[];
}

export const ORGANIZATION_ACCESS_MODULE_LABELS: Record<OrganizationAccessModule, string> = {
    agent: 'Booking Agent',
    analytics: 'Analytics',
    'audio-analyzer': 'Audio Analyzer',
    brand: 'Brand Manager',
    campaign: 'Campaign Manager',
    creative: 'Creative Director',
    crm: 'CRM',
    debug: 'Debug',
    devops: 'DevOps',
    distribution: 'Distribution',
    files: 'Files',
    finance: 'Finance',
    history: 'History',
    knowledge: 'Knowledge Base',
    legal: 'Legal',
    licensing: 'Licensing',
    marketing: 'Marketing',
    marketplace: 'Marketplace',
    memory: 'Memory',
    merch: 'Merchandise',
    notes: 'Notes',
    observability: 'Observability',
    publicist: 'Publicist',
    publishing: 'Publishing',
    registration: 'Registration Center',
    road: 'Road/Tour',
    screenwriter: 'Screenwriter',
    security: 'Security Center',
    social: 'Social Media',
    workflow: 'Workflow Builder',
};

const MANAGER_RESTRICTED = new Set<OrganizationAccessModule>([
    'debug',
    'devops',
    'observability',
    'security',
]);

const PRODUCER_MODULES = new Set<OrganizationAccessModule>([
    'audio-analyzer',
    'brand',
    'campaign',
    'creative',
    'files',
    'knowledge',
    'marketing',
    'memory',
    'merch',
    'notes',
    'publicist',
    'screenwriter',
    'social',
    'workflow',
]);

const MEMBER_MODULES = new Set<OrganizationAccessModule>([
    'files',
    'knowledge',
    'notes',
    'workflow',
]);

export function defaultModulesForOrganizationRole(role: OrganizationRole): OrganizationAccessModule[] {
    if (role === 'owner') return [...ORGANIZATION_ACCESS_MODULES];
    if (role === 'manager') {
        return ORGANIZATION_ACCESS_MODULES.filter(moduleId => !MANAGER_RESTRICTED.has(moduleId));
    }
    const allowed = role === 'producer' ? PRODUCER_MODULES : MEMBER_MODULES;
    return ORGANIZATION_ACCESS_MODULES.filter(moduleId => allowed.has(moduleId));
}

export function isOrganizationAccessModule(value: string): value is OrganizationAccessModule {
    return (ORGANIZATION_ACCESS_MODULES as readonly string[]).includes(value);
}
