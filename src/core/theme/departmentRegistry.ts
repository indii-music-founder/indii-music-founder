/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPARTMENT REGISTRY - Type-safe department theme system
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file provides the TypeScript interface for department theming.
 * Colors are defined in index.css as CSS variables (Single Source of Truth).
 *
 * Usage:
 *   import { getDeptTheme } from '@/core/theme/departmentRegistry';
 *   const theme = getDeptTheme('marketing');
 *   // theme.color = 'var(--color-dept-marketing)'
 */

/**
 * Core department types in indiiOS
 */
export type DepartmentType =
    | 'royalties'
    | 'distribution'
    | 'marketing'
    | 'legal'
    | 'creative'
    | 'touring'
    | 'publishing'
    | 'social'
    | 'licensing'
    | 'brand'
    | 'campaign';

/**
 * Internal department type including default fallback
 */
export type InternalDepartmentType = DepartmentType | 'default';

/**
 * Theme configuration for a department
 */
export interface DepartmentTheme {
    /** Unique department identifier */
    id: InternalDepartmentType;
    id: DepartmentType;
    /** CSS variable reference for the department color */
    color: string;
    /** CSS variable reference for the muted variant */
    colorMuted: string;
    /** CSS variable reference for the glow variant */
    colorGlow: string;
    /** Human-readable department label */
    label: string;
    /** Icon identifier (Material Icons / Lucide) */
    icon: string;
    /** Brief description of the department's role */
    description: string;
}

/**
 * Complete department registry with all theme configurations
 */
export const departmentRegistry: Record<DepartmentType, DepartmentTheme> = {
    royalties: {
        id: 'royalties',
        color: 'var(--color-dept-royalties)',
        colorMuted: 'var(--color-dept-royalties-muted)',
        colorGlow: 'var(--color-dept-royalties-glow)',
        label: 'Royalties & Finance',
        icon: 'payments',
        description: 'Wealth, precision, and the "Gold Standard" of accounting',
    },
    distribution: {
        id: 'distribution',
        color: 'var(--color-dept-distribution)',
        colorMuted: 'var(--color-dept-distribution-muted)',
        colorGlow: 'var(--color-dept-distribution-glow)',
        label: 'Global Distribution',
        icon: 'language',
        description: 'Data flow, logistics, and global reach',
    },
    marketing: {
        id: 'marketing',
        color: 'var(--color-dept-marketing)',
        colorMuted: 'var(--color-dept-marketing-muted)',
        colorGlow: 'var(--color-dept-marketing-glow)',
        label: 'Marketing & PR',
        icon: 'campaign',
        description: 'Energy, attention-grabbing, and "loud" promotion',
    },
    legal: {
        id: 'legal',
        color: 'var(--color-dept-legal)',
        colorMuted: 'var(--color-dept-legal-muted)',
        colorGlow: 'var(--color-dept-legal-glow)',
        label: 'Legal & Contracts',
        icon: 'gavel',
        description: 'Stability, "ink on paper," and serious protection',
    },
    creative: {
        id: 'creative',
        color: 'var(--color-dept-creative)',
        colorMuted: 'var(--color-dept-creative-muted)',
        colorGlow: 'var(--color-dept-creative-glow)',
        label: 'A&R / Creative',
        icon: 'auto_awesome',
        description: 'The intersection of passion and stability; the "magic"',
    },
    touring: {
        id: 'touring',
        color: 'var(--color-dept-touring)',
        colorMuted: 'var(--color-dept-touring-muted)',
        colorGlow: 'var(--color-dept-touring-glow)',
        label: 'Touring & Live',
        icon: 'event_available',
        description: 'Road heat, stage lights, and high-intensity movement',
    },
    publishing: {
        id: 'publishing',
        color: 'var(--color-dept-publishing)',
        colorMuted: 'var(--color-dept-publishing-muted)',
        colorGlow: 'var(--color-dept-publishing-glow)',
        label: 'Publishing',
        icon: 'library_music',
        description: 'Growth, fresh output, and catalog expansion',
    },
    social: {
        id: 'social',
        color: 'var(--color-dept-social)',
        colorMuted: 'var(--color-dept-social-muted)',
        colorGlow: 'var(--color-dept-social-glow)',
        label: 'Social Media',
        icon: 'share',
        description: 'Digital presence and viral connectivity',
    },
    licensing: {
        id: 'licensing',
        color: 'var(--color-dept-licensing)',
        colorMuted: 'var(--color-dept-licensing-muted)',
        colorGlow: 'var(--color-dept-licensing-glow)',
        label: 'Licensing',
        icon: 'verified',
        description: 'Sync deals and secondary revenue streams',
    },
    brand: {
        id: 'brand',
        color: 'var(--color-dept-brand)',
        colorMuted: 'var(--color-dept-brand-muted)',
        colorGlow: 'var(--color-dept-brand-glow)',
        label: 'Brand Identity',
        icon: 'palette',
        description: 'Identity, consistency, and golden standard',
    },
    campaign: {
        id: 'campaign',
        color: 'var(--color-dept-campaign)',
        colorMuted: 'var(--color-dept-campaign-muted)',
        colorGlow: 'var(--color-dept-campaign-glow)',
        label: 'Campaigns',
        icon: 'rocket_launch',
        description: 'Active promotions, urgency, and call-to-action',
    },
};

/**
 * Default theme used when department is unknown or missing
 */
const defaultTheme: DepartmentTheme = {
    id: 'default',
    id: 'marketing', // Note: Uses 'marketing' as closest valid type; CSS vars are --color-dept-default
    color: 'var(--color-dept-default)',
    colorMuted: 'var(--color-dept-default-muted)',
    colorGlow: 'var(--color-dept-default)',
    label: 'General',
    icon: 'smart_toy',
    description: 'Default department theme',
};

/**
 * Bolt's Safety Net: Get department theme with fallback
 *
 * @param dept - Department name (case-insensitive)
 * @returns Department theme configuration
 *
 * @example
 * const theme = getDeptTheme('marketing');
 * element.style.setProperty('--dept-color', theme.color);
 */
export const getDeptTheme = (dept?: string): DepartmentTheme => {
    if (!dept) return defaultTheme;
    const key = dept.toLowerCase() as DepartmentType;
    return departmentRegistry[key] || defaultTheme;
};

/**
 * Get CSS variable name for a department
 *
 * @param dept - Department name
 * @returns CSS variable string like 'var(--color-dept-marketing)'
 */
export const getDeptCssVar = (dept?: string): string => {
    return getDeptTheme(dept).color;
};

/**
 * Apply department color to an element via CSS custom property
 *
 * @param element - DOM element to style
 * @param dept - Department name
 */
export const applyDeptColor = (element: HTMLElement, dept: string): void => {
    const theme = getDeptTheme(dept);
    element.style.setProperty('--dept-color', theme.color);
};
