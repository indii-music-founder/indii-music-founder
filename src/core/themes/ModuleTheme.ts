import { ModuleId } from '@/core/constants';

export interface ModuleTheme {
    /** The primary accent color for this module (e.g. text-blue-500, border-blue-500) */
    accent: string;
    /** The background gradient underlying the entire module space */
    backgroundGradient: string;
    /**
     * Optional ambient configuration.
     * Determines what subtle background SVG, texture, or particle effects appear.
     */
    ambientConfig?: {
        type: 'particles' | 'grid' | 'noise' | 'waves' | 'dots' | 'geometric' | 'vectors' | 'mesh';
        opacity: number;
        blendMode?: string;
    };
    /** A descriptive name for the office/theme */
    officeName: string;
}

export const MODULE_THEMES: Record<ModuleId, ModuleTheme> = {
    'dashboard': {
        officeName: 'HQ Overview',
        accent: '#8b5cf6', // purple-500
        backgroundGradient: 'radial-gradient(circle at 50% -20%, rgba(139, 92, 246, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.15 }
    },
    'creative': {
        officeName: 'Creative Director Studio',
        accent: '#ec4899', // pink-500
        backgroundGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.3, blendMode: 'screen' }
    },
    'video': {
        officeName: 'Video Editing Bay',
        accent: '#ef4444', // red-500
        backgroundGradient: 'radial-gradient(circle at 100% 50%, rgba(239, 68, 68, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'legal': {
        officeName: 'Legal & IP Department',
        accent: '#64748b', // slate-500
        backgroundGradient: 'linear-gradient(to bottom, rgba(100, 116, 139, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.4 }
    },
    'marketing': {
        officeName: 'Marketing Department',
        accent: '#f97316', // orange-500
        backgroundGradient: 'radial-gradient(circle at 0% 0%, rgba(249, 115, 22, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    },
    'workflow': {
        officeName: 'Workflow Lab',
        accent: '#06b6d4', // sky-500
        backgroundGradient: 'linear-gradient(to right, rgba(6, 182, 212, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'knowledge': {
        officeName: 'Knowledge Base',
        accent: '#eab308', // yellow-500
        backgroundGradient: 'radial-gradient(circle at 50% 100%, rgba(234, 179, 8, 0.04), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.3 }
    },
    'road': {
        officeName: 'Road Manager',
        accent: '#10b981', // emerald-500
        backgroundGradient: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.15 }
    },
    'social': {
        officeName: 'Social War Room',
        accent: '#3b82f6', // blue-500
        backgroundGradient: 'radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.25 }
    },
    'brand': {
        officeName: 'Brand Manager',
        accent: '#d946ef', // fuchsia-500
        backgroundGradient: 'linear-gradient(to top right, rgba(217, 70, 239, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.2 }
    },
    'campaign': {
        officeName: 'Campaign Manager',
        accent: '#f43f5e', // rose-500
        backgroundGradient: 'radial-gradient(circle at 20% 80%, rgba(244, 63, 94, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'publicist': {
        officeName: 'Publicist Hub',
        accent: '#a855f7', // purple-500
        backgroundGradient: 'linear-gradient(180deg, rgba(168, 85, 247, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.15 }
    },
    'publishing': {
        officeName: 'Publishing Desk',
        accent: '#14b8a6', // cyan-500
        backgroundGradient: 'radial-gradient(circle at 50% -10%, rgba(20, 184, 166, 0.07), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.4 }
    },
    'finance': {
        officeName: 'Finance Department',
        accent: '#22c55e', // green-500
        backgroundGradient: 'linear-gradient(to left, rgba(34, 197, 94, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.1 }
    },
    'licensing': {
        officeName: 'Licensing Board',
        accent: '#eab308', // yellow-500
        backgroundGradient: 'radial-gradient(circle at 70% 30%, rgba(234, 179, 8, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.2 }
    },
    'onboarding': {
        officeName: 'Onboarding Center',
        accent: '#8b5cf6', // purple-500
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'particles', opacity: 0.5 }
    },
    'select-org': {
        officeName: 'Org Selection',
        accent: '#6366f1', // indigo-500
        backgroundGradient: 'linear-gradient(to top, rgba(99, 102, 241, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'agent': {
        officeName: 'Agent Diagnostics',
        accent: '#8b5cf6', // purple-500 (Matches indiiConductor)
        backgroundGradient: 'radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'distribution': {
        officeName: 'Distribution Engine',
        accent: '#3b82f6', // blue-500
        backgroundGradient: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.15 }
    },
    'files': {
        officeName: 'Asset Library',
        accent: '#64748b', // slate-500
        backgroundGradient: 'radial-gradient(circle at 0% 100%, rgba(100, 116, 139, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.3 }
    },
    'merch': {
        officeName: 'Merchandise Lab',
        accent: '#d946ef', // fuchsia-500
        backgroundGradient: 'linear-gradient(135deg, rgba(217, 70, 239, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    },
    'marketplace': {
        officeName: 'Marketplace',
        accent: '#f59e0b', // amber-500
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.03), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.1 }
    },
    'audio-analyzer': {
        officeName: 'Audio Genomics',
        accent: '#0ea5e9', // light-blue-500
        backgroundGradient: 'radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.4 }
    },
    'observability': {
        officeName: 'Observability Matrix',
        accent: '#6366f1', // indigo-500
        backgroundGradient: 'radial-gradient(circle at 0% 50%, rgba(99, 102, 241, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'history': {
        officeName: 'Timeline Archive',
        accent: '#71717a', // neutral-500
        backgroundGradient: 'linear-gradient(180deg, rgba(113, 113, 122, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.25 }
    },
    'debug': {
        officeName: 'Multimodal Gauntlet',
        accent: '#ef4444', // red-500
        backgroundGradient: 'linear-gradient(to right, rgba(239, 68, 68, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'investor': {
        officeName: 'Investor Deck',
        accent: '#10b981', // emerald-500
        backgroundGradient: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'capture': {
        officeName: 'Ghost Capture',
        accent: '#64748b', // slate-500
        backgroundGradient: 'radial-gradient(circle at 100% 100%, rgba(100, 116, 139, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'particles', opacity: 0.15 }
    },
    'memory': {
        officeName: 'Neural Archive',
        accent: '#8b5cf6', // purple-500
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.07), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.3 }
    },
    'settings': {
        officeName: 'Settings',
        accent: '#9ca3af', // zinc-400
        backgroundGradient: 'linear-gradient(180deg, rgba(156, 163, 175, 0.04), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.1 }
    },
    'mobile-remote': {
        officeName: 'indiiREMOTE',
        accent: '#8b5cf6', // purple-500
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.15 }
    },
    'analytics': {
        officeName: 'Growth Intelligence',
        accent: '#3b82f6', // blue-500
        backgroundGradient: 'radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'desktop': {
        officeName: 'Desktop Main',
        accent: '#a855f7', // purple-500
        backgroundGradient: 'radial-gradient(circle at 50% -20%, rgba(168, 85, 247, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    }
};

export function getModuleTheme(moduleId: ModuleId): ModuleTheme {
    return MODULE_THEMES[moduleId] || MODULE_THEMES['dashboard'];
}
