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
        accent: '#6366f1', // indigo-500 (System default)
        backgroundGradient: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.15 }
    },
    'creative': {
        officeName: 'Creative Director Studio',
        accent: '#9C27B0', // Purple (Official)
        backgroundGradient: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.3, blendMode: 'screen' }
    },
    'video': {
        officeName: 'Video Editing Bay',
        accent: '#9C27B0', // Purple (Shares with Creative)
        backgroundGradient: 'radial-gradient(circle at 100% 50%, rgba(156, 39, 176, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'legal': {
        officeName: 'Legal & IP Department',
        accent: '#455A64', // Slate (Official)
        backgroundGradient: 'linear-gradient(to bottom, rgba(69, 90, 100, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.4 }
    },
    'marketing': {
        officeName: 'Marketing Department',
        accent: '#E91E63', // Magenta (Official)
        backgroundGradient: 'radial-gradient(circle at 0% 0%, rgba(233, 30, 99, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    },
    'workflow': {
        officeName: 'Workflow Lab',
        accent: '#00BCD4', // Cyan (Official)
        backgroundGradient: 'linear-gradient(to right, rgba(0, 188, 212, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'knowledge': {
        officeName: 'Knowledge Base',
        accent: '#2196F3', // Electric Blue (Shares with Distribution)
        backgroundGradient: 'radial-gradient(circle at 50% 100%, rgba(33, 150, 243, 0.04), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.3 }
    },
    'road': {
        officeName: 'Road Manager',
        accent: '#FF5722', // Deep Orange (Official)
        backgroundGradient: 'linear-gradient(to bottom right, rgba(255, 87, 34, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.15 }
    },
    'social': {
        officeName: 'Social War Room',
        accent: '#00BCD4', // Cyan (Official)
        backgroundGradient: 'radial-gradient(circle at 80% 20%, rgba(0, 188, 212, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.25 }
    },
    'brand': {
        officeName: 'Brand Manager',
        accent: '#FFB300', // Amber (Official)
        backgroundGradient: 'linear-gradient(to top right, rgba(255, 179, 0, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.2 }
    },
    'campaign': {
        officeName: 'Campaign Manager',
        accent: '#FF7043', // Coral (Official)
        backgroundGradient: 'radial-gradient(circle at 20% 80%, rgba(255, 112, 67, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'publicist': {
        officeName: 'Publicist Hub',
        accent: '#E91E63', // Magenta (Shares with Marketing)
        backgroundGradient: 'linear-gradient(180deg, rgba(233, 30, 99, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.15 }
    },
    'publishing': {
        officeName: 'Publishing Desk',
        accent: '#8BC34A', // Lime (Official)
        backgroundGradient: 'radial-gradient(circle at 50% -10%, rgba(139, 195, 74, 0.07), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.4 }
    },
    'finance': {
        officeName: 'Finance Department',
        accent: '#FFC107', // Gold (Official)
        backgroundGradient: 'linear-gradient(to left, rgba(255, 193, 7, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.1 }
    },
    'licensing': {
        officeName: 'Licensing Board',
        accent: '#009688', // Teal (Official)
        backgroundGradient: 'radial-gradient(circle at 70% 30%, rgba(0, 150, 136, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.2 }
    },
    'onboarding': {
        officeName: 'Onboarding Center',
        accent: '#9C27B0', // Purple
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(156, 39, 176, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'particles', opacity: 0.5 }
    },
    'select-org': {
        officeName: 'Org Selection',
        accent: '#6366f1', // Indigo
        backgroundGradient: 'linear-gradient(to top, rgba(99, 102, 241, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'agent': {
        officeName: 'Agent Diagnostics',
        accent: '#9C27B0', // Purple
        backgroundGradient: 'radial-gradient(circle at 100% 0%, rgba(156, 39, 176, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'distribution': {
        officeName: 'Distribution Engine',
        accent: '#2196F3', // Electric Blue (Official)
        backgroundGradient: 'linear-gradient(to bottom, rgba(33, 150, 243, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.15 }
    },
    'files': {
        officeName: 'Asset Library',
        accent: '#64748b', // Slate
        backgroundGradient: 'radial-gradient(circle at 0% 100%, rgba(100, 116, 139, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.3 }
    },
    'merch': {
        officeName: 'Merchandise Lab',
        accent: '#FFB300', // Amber
        backgroundGradient: 'linear-gradient(135deg, rgba(255, 179, 0, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    },
    'marketplace': {
        officeName: 'Marketplace',
        accent: '#FFB300', // Amber
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(255, 179, 0, 0.03), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'mesh', opacity: 0.1 }
    },
    'audio-analyzer': {
        officeName: 'Audio Genomics',
        accent: '#2196F3', // Electric Blue
        backgroundGradient: 'radial-gradient(circle at 50% 100%, rgba(33, 150, 243, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.4 }
    },
    'observability': {
        officeName: 'Observability Matrix',
        accent: '#2196F3', // Electric Blue
        backgroundGradient: 'radial-gradient(circle at 0% 50%, rgba(33, 150, 243, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'history': {
        officeName: 'Timeline Archive',
        accent: '#71717a', // Neutral
        backgroundGradient: 'linear-gradient(180deg, rgba(113, 113, 122, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'noise', opacity: 0.25 }
    },
    'debug': {
        officeName: 'Multimodal Gauntlet',
        accent: '#ef4444', // Red
        backgroundGradient: 'linear-gradient(to right, rgba(239, 68, 68, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.2 }
    },
    'investor': {
        officeName: 'Investor Deck',
        accent: '#2196F3', // Electric Blue
        backgroundGradient: 'radial-gradient(circle at 50% 0%, rgba(33, 150, 243, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'geometric', opacity: 0.1 }
    },
    'capture': {
        officeName: 'Ghost Capture',
        accent: '#009688', // Teal
        backgroundGradient: 'radial-gradient(circle at 100% 100%, rgba(0, 150, 136, 0.08), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'particles', opacity: 0.15 }
    },
    'memory': {
        officeName: 'Neural Archive',
        accent: '#009688', // Teal
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(0, 150, 136, 0.07), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'vectors', opacity: 0.3 }
    },
    'settings': {
        officeName: 'Settings',
        accent: '#00BCD4', // Cyan
        backgroundGradient: 'linear-gradient(180deg, rgba(0, 188, 212, 0.04), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.1 }
    },
    'mobile-remote': {
        officeName: 'indiiREMOTE',
        accent: '#6366f1', // Indigo
        backgroundGradient: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'waves', opacity: 0.15 }
    },
    'analytics': {
        officeName: 'Growth Intelligence',
        accent: '#a855f7', // Purple-500
        backgroundGradient: 'radial-gradient(circle at 80% 0%, rgba(168, 85, 247, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.2 }
    },
    'desktop': {
        officeName: 'Desktop Main',
        accent: '#a855f7', // Purple
        backgroundGradient: 'radial-gradient(circle at 50% -20%, rgba(168, 85, 247, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'dots', opacity: 0.2 }
    },
    'founders-checkout': {
        officeName: 'Founders Program',
        accent: '#f59e0b', // Amber
        backgroundGradient: 'radial-gradient(circle at 50% -20%, rgba(245, 158, 11, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'particles', opacity: 0.1 }
    },
    'video-popout': {
        officeName: 'Video Ext. Display',
        accent: '#0d1117',
        backgroundGradient: 'none',
    },
    'registration': {
        officeName: 'Registration Center',
        accent: '#009688', // Teal (filing/compliance feel)
        backgroundGradient: 'radial-gradient(circle at 30% 70%, rgba(0, 150, 136, 0.06), rgba(0, 0, 0, 0))',
        ambientConfig: { type: 'grid', opacity: 0.15 },
    },
};


export function getModuleTheme(moduleId: ModuleId): ModuleTheme {
    return MODULE_THEMES[moduleId] || MODULE_THEMES['dashboard'];
}
