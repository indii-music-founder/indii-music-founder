import { type ModuleId } from '@/core/constants';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPARTMENT COLOR SYSTEM - Module Theme Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file maps modules to their official brand colors defined in index.css.
 * The CSS variables (--color-dept-*) are the Single Source of Truth.
 *
 * Color Assignments (from indiiOS Brand Guide):
 * - Royalties/Finance: Gold #FFC107 - Wealth, precision
 * - Distribution: Electric Blue #2196F3 - Data flow, logistics
 * - Marketing/PR: Magenta #E91E63 - Energy, attention
 * - Legal: Slate #455A64 - Stability, serious protection
 * - Creative/A&R: Purple #9C27B0 - Magic, passion + stability
 * - Touring/Road: Deep Orange #FF5722 - Road heat, stage lights
 * - Publishing: Lime #8BC34A - Growth, catalog expansion
 * - Social: Cyan #00BCD4 - Digital presence, connectivity
 * - Licensing: Teal #009688 - Sync deals, secondary revenue
 * - Brand: Amber #FFB300 - Identity, consistency
 * - Campaign: Coral #FF7043 - Active promotions, urgency
 */

export interface ModuleColor {
    text: string;
    bg: string;
    border: string;
    ring: string;
    hoverText: string;
    hoverBg: string;
    /** CSS variable name for direct style access */
    cssVar: string;
}

/**
 * Department-to-CSS-Variable mapping for programmatic access
 * Use this when you need the raw CSS variable name
 */
export const departmentCssVars = {
    // Base Department Colors
    royalties: '--color-dept-royalties',
    distribution: '--color-dept-distribution',
    marketing: '--color-dept-marketing',
    legal: '--color-dept-legal',
    creative: '--color-dept-creative',
    touring: '--color-dept-touring',
    publishing: '--color-dept-publishing',
    social: '--color-dept-social',
    licensing: '--color-dept-licensing',
    brand: '--color-dept-brand',
    campaign: '--color-dept-campaign',
    default: '--color-dept-default',

    // Module Mappings (Aliases)
    finance: '--color-dept-royalties',     // Finance shares Royalties' gold
    publicist: '--color-dept-marketing',   // Publicist shares Marketing
    road: '--color-dept-touring',          // Road Manager = Touring
    video: '--color-dept-creative',        // Video shares Creative
    agent: '--color-dept-creative',        // Agent shares Creative
    'audio-analyzer': '--color-dept-creative', // Audio Analyzer shares Creative
    onboarding: '--color-dept-creative',   // Onboarding shares Creative
    music: '--color-dept-publishing',      // Music shares Publishing
    workflow: '--color-dept-social',       // Workflow shares Social
    showroom: '--color-dept-brand',        // Showroom shares Brand
    merch: '--color-dept-brand',           // Merch shares Brand
    knowledge: '--color-dept-distribution', // Knowledge shares Distribution
    files: '--color-dept-default',
    dashboard: '--color-dept-default',
    'select-org': '--color-dept-default',
    'banana-preview': '--color-dept-royalties', // Banana uses Royalties/Gold
} as const;

/**
 * Get the CSS variable for a department
 * @example getDepartmentCssVar('marketing') // 'var(--color-dept-marketing)'
 */
export const getDepartmentCssVar = (dept: string): string => {
    const key = dept.toLowerCase() as keyof typeof departmentCssVars;
    return `var(${departmentCssVars[key] || departmentCssVars.default})`;
};

export const moduleColors: Record<ModuleId, ModuleColor> = {
    // ═══════════════════════════════════════════════════════════════════════════
    // MANAGER'S OFFICE - Executive roles with distinct brand colors
    // ═══════════════════════════════════════════════════════════════════════════
    brand: {
        text: 'text-dept-brand',
        bg: 'bg-dept-brand/10',
        border: 'border-dept-brand',
        ring: 'focus-within:ring-dept-brand/50',
        hoverText: 'hover:text-dept-brand',
        hoverBg: 'hover:bg-dept-brand/5',
        cssVar: '--color-dept-brand',
    },
    road: {
        // Touring/Live - Deep Orange #FF5722: Road heat, stage lights
        text: 'text-dept-touring',
        bg: 'bg-dept-touring/10',
        border: 'border-dept-touring',
        ring: 'focus-within:ring-dept-touring/50',
        hoverText: 'hover:text-dept-touring',
        hoverBg: 'hover:bg-dept-touring/5',
        cssVar: '--color-dept-touring',
    },
    campaign: {
        // Campaign - Coral #FF7043: Active promotions, urgency
        text: 'text-dept-campaign',
        bg: 'bg-dept-campaign/10',
        border: 'border-dept-campaign',
        ring: 'focus-within:ring-dept-campaign/50',
        hoverText: 'hover:text-dept-campaign',
        hoverBg: 'hover:bg-dept-campaign/5',
        cssVar: '--color-dept-campaign',
    },
    publicist: {
        // Publicist shares Marketing's energy
        text: 'text-dept-marketing',
        bg: 'bg-dept-marketing/10',
        border: 'border-dept-marketing',
        ring: 'focus-within:ring-dept-marketing/50',
        hoverText: 'hover:text-dept-marketing',
        hoverBg: 'hover:bg-dept-marketing/5',
        cssVar: '--color-dept-marketing',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPARTMENTS - Core operational divisions with official brand colors
    // ═══════════════════════════════════════════════════════════════════════════
    marketing: {
        // Marketing & PR - Vibrant Magenta #E91E63: Energy, attention-grabbing
        text: 'text-dept-marketing',
        bg: 'bg-dept-marketing/10',
        border: 'border-dept-marketing',
        ring: 'focus-within:ring-dept-marketing/50',
        hoverText: 'hover:text-dept-marketing',
        hoverBg: 'hover:bg-dept-marketing/5',
        cssVar: '--color-dept-marketing',
    },
    social: {
        // Social Media - Cyan #00BCD4: Digital presence, viral connectivity
        text: 'text-dept-social',
        bg: 'bg-dept-social/10',
        border: 'border-dept-social',
        ring: 'focus-within:ring-dept-social/50',
        hoverText: 'hover:text-dept-social',
        hoverBg: 'hover:bg-dept-social/5',
        cssVar: '--color-dept-social',
    },
    legal: {
        // Legal & Contracts - Slate #455A64: Stability, "ink on paper"
        text: 'text-dept-legal',
        bg: 'bg-dept-legal/10',
        border: 'border-dept-legal',
        ring: 'focus-within:ring-dept-legal/50',
        hoverText: 'hover:text-dept-legal',
        hoverBg: 'hover:bg-dept-legal/5',
        cssVar: '--color-dept-legal',
    },
    publishing: {
        // Publishing - Lime #8BC34A: Growth, fresh output, catalog expansion
        text: 'text-dept-publishing',
        bg: 'bg-dept-publishing/10',
        border: 'border-dept-publishing',
        ring: 'focus-within:ring-dept-publishing/50',
        hoverText: 'hover:text-dept-publishing',
        hoverBg: 'hover:bg-dept-publishing/5',
        cssVar: '--color-dept-publishing',
    },
    finance: {
        // Finance & Royalties - Gold #FFC107: Wealth, precision, "Gold Standard"
        text: 'text-dept-royalties',
        bg: 'bg-dept-royalties/10',
        border: 'border-dept-royalties',
        ring: 'focus-within:ring-dept-royalties/50',
        hoverText: 'hover:text-dept-royalties',
        hoverBg: 'hover:bg-dept-royalties/5',
        cssVar: '--color-dept-royalties',
    },
    licensing: {
        // Licensing - Teal #009688: Sync deals, secondary revenue streams
        text: 'text-dept-licensing',
        bg: 'bg-dept-licensing/10',
        border: 'border-dept-licensing',
        ring: 'focus-within:ring-dept-licensing/50',
        hoverText: 'hover:text-dept-licensing',
        hoverBg: 'hover:bg-dept-licensing/5',
        cssVar: '--color-dept-licensing',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // CREATIVE TOOLS - Production-focused modules
    // ═══════════════════════════════════════════════════════════════════════════
    creative: {
        // A&R / Creative - Purple #9C27B0: Magic, passion + stability
        text: 'text-dept-creative',
        bg: 'bg-dept-creative/10',
        border: 'border-dept-creative',
        ring: 'focus-within:ring-dept-creative/50',
        hoverText: 'hover:text-dept-creative',
        hoverBg: 'hover:bg-dept-creative/5',
        cssVar: '--color-dept-creative',
    },
    video: {
        // Video shares Creative's purple aesthetic
        text: 'text-dept-creative',
        bg: 'bg-dept-creative/10',
        border: 'border-dept-creative',
        ring: 'focus-within:ring-dept-creative/50',
        hoverText: 'hover:text-dept-creative',
        hoverBg: 'hover:bg-dept-creative/5',
        cssVar: '--color-dept-creative',
    },
    music: {
        // Music tools share Publishing's growth vibe
        text: 'text-dept-publishing',
        bg: 'bg-dept-publishing/10',
        border: 'border-dept-publishing',
        ring: 'focus-within:ring-dept-publishing/50',
        hoverText: 'hover:text-dept-publishing',
        hoverBg: 'hover:bg-dept-publishing/5',
        cssVar: '--color-dept-publishing',
    },
    workflow: {
        // Workflow uses Social's connectivity cyan
        text: 'text-dept-social',
        bg: 'bg-dept-social/10',
        border: 'border-dept-social',
        ring: 'focus-within:ring-dept-social/50',
        hoverText: 'hover:text-dept-social',
        hoverBg: 'hover:bg-dept-social/5',
        cssVar: '--color-dept-social',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SYSTEM & UTILITY - Neutral tones for non-departmental views
    // ═══════════════════════════════════════════════════════════════════════════
    dashboard: {
        text: 'text-dept-default',
        bg: 'bg-dept-default/10',
        border: 'border-dept-default',
        ring: 'focus-within:ring-dept-default/50',
        hoverText: 'hover:text-white',
        hoverBg: 'hover:bg-dept-default/5',
        cssVar: '--color-dept-default',
    },
    'select-org': {
        text: 'text-dept-default',
        bg: 'bg-dept-default/10',
        border: 'border-dept-default',
        ring: 'focus-within:ring-dept-default/50',
        hoverText: 'hover:text-white',
        hoverBg: 'hover:bg-dept-default/5',
        cssVar: '--color-dept-default',
    },
    knowledge: {
        // Knowledge base uses Distribution's blue (data flow)
        text: 'text-dept-distribution',
        bg: 'bg-dept-distribution/10',
        border: 'border-dept-distribution',
        ring: 'focus-within:ring-dept-distribution/50',
        hoverText: 'hover:text-dept-distribution',
        hoverBg: 'hover:bg-dept-distribution/5',
        cssVar: '--color-dept-distribution',
    },
    onboarding: {
        // Onboarding uses Creative's welcoming purple
        text: 'text-dept-creative',
        bg: 'bg-dept-creative/10',
        border: 'border-dept-creative',
        ring: 'focus-within:ring-dept-creative/50',
        hoverText: 'hover:text-dept-creative',
        hoverBg: 'hover:bg-dept-creative/5',
        cssVar: '--color-dept-creative',
    },
    showroom: {
        // Showroom uses Brand's amber (product identity)
        text: 'text-dept-brand',
        bg: 'bg-dept-brand/10',
        border: 'border-dept-brand',
        ring: 'focus-within:ring-dept-brand/50',
        hoverText: 'hover:text-dept-brand',
        hoverBg: 'hover:bg-dept-brand/5',
        cssVar: '--color-dept-brand',
    },
    agent: {
        // Agent uses Creative's purple (AI magic)
        text: 'text-dept-creative',
        bg: 'bg-dept-creative/10',
        border: 'border-dept-creative',
        ring: 'focus-within:ring-dept-creative/50',
        hoverText: 'hover:text-dept-creative',
        hoverBg: 'hover:bg-dept-creative/5',
        cssVar: '--color-dept-creative',
    },
    distribution: {
        // Distribution - Electric Blue #2196F3: Data flow, logistics, global reach
        text: 'text-dept-distribution',
        bg: 'bg-dept-distribution/10',
        border: 'border-dept-distribution',
        ring: 'focus-within:ring-dept-distribution/50',
        hoverText: 'hover:text-dept-distribution',
        hoverBg: 'hover:bg-dept-distribution/5',
        cssVar: '--color-dept-distribution',
    },
    merch: {
        // Merch uses Brand's amber (product identity)
        text: 'text-dept-brand',
        bg: 'bg-dept-brand/10',
        border: 'border-dept-brand',
        ring: 'focus-within:ring-dept-brand/50',
        hoverText: 'hover:text-dept-brand',
        hoverBg: 'hover:bg-dept-brand/5',
        cssVar: '--color-dept-brand',
    },
    files: {
        text: 'text-dept-default',
        bg: 'bg-dept-default/10',
        border: 'border-dept-default',
        ring: 'focus-within:ring-dept-default/50',
        hoverText: 'hover:text-white',
        hoverBg: 'hover:bg-dept-default/5',
        cssVar: '--color-dept-default',
    },
    'audio-analyzer': {
        // Audio tools share Creative's purple
        text: 'text-dept-creative',
        bg: 'bg-dept-creative/10',
        border: 'border-dept-creative',
        ring: 'focus-within:ring-dept-creative/50',
        hoverText: 'hover:text-dept-creative',
        hoverBg: 'hover:bg-dept-creative/5',
        cssVar: '--color-dept-creative',
    },
    'banana-preview': {
        // Banana uses Royalties' gold (premium feature)
        text: 'text-dept-royalties',
        bg: 'bg-dept-royalties/10',
        border: 'border-dept-royalties',
        ring: 'focus-within:ring-dept-royalties/50',
        hoverText: 'hover:text-dept-royalties',
        hoverBg: 'hover:bg-dept-royalties/5',
        cssVar: '--color-dept-royalties',
    }
};

export const getColorForModule = (moduleId: ModuleId): ModuleColor => {
    return moduleColors[moduleId] || moduleColors.dashboard;
};
