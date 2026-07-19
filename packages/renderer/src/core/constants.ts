// ============================================================================
// Module IDs - All valid navigation modules
// ============================================================================

export const MODULE_IDS = [
    'dashboard',
    'creative',
    'legal',
    'marketing',
    'workflow',
    'knowledge',
    'road',
    'social',
    'brand',
    'campaign',
    'publicist',
    'publishing',
    'finance',
    'licensing',
    'onboarding',
    'select-org',
    'agent',
    'distribution',
    'files',
    'merch',
    'marketplace',
    'audio-analyzer',
    'observability',
    'history',
    'notes',
    'debug',
    'investor',
    'capture',
    'memory',
    'settings',
    'mobile-remote',
    'analytics',
    'desktop',
    'founders-checkout',
    'founders-portal',
    'founders-recognition',
    'video-popout',
    'registration',
    'security',
    'devops',
    'screenwriter',
    'crm'
] as const;

export type ModuleId = typeof MODULE_IDS[number];

// Modules that hide the sidebar and command bar
export const STANDALONE_MODULES: ModuleId[] = ['select-org', 'onboarding', 'investor', 'capture', 'mobile-remote', 'desktop', 'founders-checkout', 'founders-portal', 'video-popout'];

// ============================================================================
// Type Guard
// ============================================================================

export function isValidModule(module: string): module is ModuleId {
    return MODULE_IDS.includes(module as ModuleId);
}

// ============================================================================
// Module to Agent Alignment
// ============================================================================

export const MODULE_AGENT_MAP: Record<ModuleId, string> = {
    'dashboard': 'generalist',
    'workflow': 'generalist',
    'history': 'generalist',
    'notes': 'memory',
    'memory': 'generalist',
    'knowledge': 'generalist',
    'creative': 'creative',
    'video-popout': 'video',
    'devops': 'devops',
    'screenwriter': 'screenwriter',
    'legal': 'legal',
    'marketing': 'marketing',
    'crm': 'marketing',
    'campaign': 'marketing',
    'road': 'road',
    'social': 'social',
    'brand': 'brand',
    'publicist': 'publicist',
    'publishing': 'publishing',
    'finance': 'finance',
    'founders-checkout': 'finance',
    'founders-portal': 'finance',
    'founders-recognition': 'generalist',
    'licensing': 'licensing',
    'distribution': 'distribution',
    'merch': 'merchandise',
    'audio-analyzer': 'music',
    'analytics': 'analytics',
    'onboarding': 'curriculum',
    'registration': 'curriculum',
    'observability': 'devops',
    'debug': 'generalist',
    'desktop': 'generalist',
    'security': 'security',
    // Fallbacks to generalist for other modules
    'select-org': 'generalist',
    'agent': 'generalist',
    'files': 'generalist',
    'marketplace': 'generalist',
    'investor': 'generalist',
    'capture': 'generalist',
    'settings': 'generalist',
    'mobile-remote': 'generalist'
};

// ============================================================================
// Theme CSS Variables (use in tailwind classes or inline styles)
// ============================================================================

export const THEME = {
    background: 'var(--color-background, #0d1117)',
    surface: 'var(--color-surface, #161b22)',
    border: 'var(--color-border, #30363d)',
    text: {
        primary: 'var(--color-text-primary, #ffffff)',
        secondary: 'var(--color-text-secondary, #8b949e)',
        muted: 'var(--color-text-muted, #6e7681)'
    },
    accent: {
        primary: 'var(--color-accent-primary, #3b82f6)',
        secondary: 'var(--color-accent-secondary, #6366f1)'
    }
} as const;

// ============================================================================
// Project sentinels (ISSUE-772 / ISSUE-758)
// ============================================================================
// Historically the codebase used TWO different "no project selected" sentinels:
// appSlice defaulted currentProjectId to 'default' while StorageService stamped
// assets with 'default-project'. Both values exist in production Firestore data,
// so reads must accept both while all new writes use DEFAULT_PROJECT_ID.

export const DEFAULT_PROJECT_ID = 'default-project';

/** Legacy sentinel written by appSlice before unification. Read-side only. */
export const LEGACY_DEFAULT_PROJECT_ID = 'default';

/** True when the id denotes the unassigned/default project bucket (either era). */
export function isDefaultProject(projectId: string | null | undefined): boolean {
    return !projectId || projectId === DEFAULT_PROJECT_ID || projectId === LEGACY_DEFAULT_PROJECT_ID;
}

/**
 * True when an item stamped with `itemProjectId` belongs to the project view
 * `viewProjectId` — treating both default-era sentinels as one bucket.
 */
export function projectBucketMatches(itemProjectId: string | null | undefined, viewProjectId: string | null | undefined): boolean {
    if (isDefaultProject(viewProjectId)) return isDefaultProject(itemProjectId);
    return itemProjectId === viewProjectId;
}
