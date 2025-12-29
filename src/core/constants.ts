// ============================================================================
// Module IDs - All valid navigation modules
// ============================================================================

export const MODULE_IDS = [
    'dashboard',
    'creative',
    'video',
    'music',
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
    'showroom',
    'onboarding',
    'select-org',
    'agent',
    'distribution',
    'files'
] as const;

export type ModuleId = typeof MODULE_IDS[number];

// Modules that hide the sidebar and command bar
export const STANDALONE_MODULES: ModuleId[] = ['select-org', 'onboarding', 'dashboard'];

// ============================================================================
// Type Guard
// ============================================================================

export function isValidModule(module: string): module is ModuleId {
    return MODULE_IDS.includes(module as ModuleId);
}

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
