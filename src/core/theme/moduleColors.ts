import { AppSlice } from '../store/slices/appSlice';

export interface ModuleColor {
    text: string;
    bg: string;
    border: string;
    ring: string;
    hoverText: string;
    hoverBg: string;
}

export const moduleColors: Record<AppSlice['currentModule'], ModuleColor> = {
    // Manager's Office
    brand: {
        text: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400',
        ring: 'focus-within:ring-amber-400/50',
        hoverText: 'hover:text-amber-200',
        hoverBg: 'hover:bg-amber-400/5',
    },
    road: {
        text: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        border: 'border-yellow-400',
        ring: 'focus-within:ring-yellow-400/50',
        hoverText: 'hover:text-yellow-200',
        hoverBg: 'hover:bg-yellow-400/5',
    },
    campaign: {
        text: 'text-orange-400',
        bg: 'bg-orange-400/10',
        border: 'border-orange-400',
        ring: 'focus-within:ring-orange-400/50',
        hoverText: 'hover:text-orange-200',
        hoverBg: 'hover:bg-orange-400/5',
    },
    publicist: {
        text: 'text-orange-300',
        bg: 'bg-orange-300/10',
        border: 'border-orange-300',
        ring: 'focus-within:ring-orange-300/50',
        hoverText: 'hover:text-orange-100',
        hoverBg: 'hover:bg-orange-300/5',
    },

    // Departments
    marketing: {
        text: 'text-teal-400',
        bg: 'bg-teal-400/10',
        border: 'border-teal-400',
        ring: 'focus-within:ring-teal-400/50',
        hoverText: 'hover:text-teal-200',
        hoverBg: 'hover:bg-teal-400/5',
    },
    social: {
        text: 'text-cyan-400',
        bg: 'bg-cyan-400/10',
        border: 'border-cyan-400',
        ring: 'focus-within:ring-cyan-400/50',
        hoverText: 'hover:text-cyan-200',
        hoverBg: 'hover:bg-cyan-400/5',
    },
    legal: {
        text: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        border: 'border-emerald-400',
        ring: 'focus-within:ring-emerald-400/50',
        hoverText: 'hover:text-emerald-200',
        hoverBg: 'hover:bg-emerald-400/5',
    },
    publishing: {
        text: 'text-lime-400',
        bg: 'bg-lime-400/10',
        border: 'border-lime-400',
        ring: 'focus-within:ring-lime-400/50',
        hoverText: 'hover:text-lime-200',
        hoverBg: 'hover:bg-lime-400/5',
    },
    finance: {
        text: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500',
        ring: 'focus-within:ring-green-500/50',
        hoverText: 'hover:text-green-300',
        hoverBg: 'hover:bg-green-500/5',
    },
    licensing: {
        text: 'text-teal-300',
        bg: 'bg-teal-300/10',
        border: 'border-teal-300',
        ring: 'focus-within:ring-teal-300/50',
        hoverText: 'hover:text-teal-100',
        hoverBg: 'hover:bg-teal-300/5',
    },

    // Tools
    music: {
        text: 'text-lime-500',
        bg: 'bg-lime-500/10',
        border: 'border-lime-500',
        ring: 'focus-within:ring-lime-500/50',
        hoverText: 'hover:text-lime-300',
        hoverBg: 'hover:bg-lime-500/5',
    },
    workflow: {
        text: 'text-cyan-300',
        bg: 'bg-cyan-300/10',
        border: 'border-cyan-300',
        ring: 'focus-within:ring-cyan-300/50',
        hoverText: 'hover:text-cyan-100',
        hoverBg: 'hover:bg-cyan-300/5',
    },

    // Others
    creative: {
        text: 'text-pink-400',
        bg: 'bg-pink-400/10',
        border: 'border-pink-400',
        ring: 'focus-within:ring-pink-400/50',
        hoverText: 'hover:text-pink-200',
        hoverBg: 'hover:bg-pink-400/5',
    },
    video: {
        text: 'text-fuchsia-400',
        bg: 'bg-fuchsia-400/10',
        border: 'border-fuchsia-400',
        ring: 'focus-within:ring-fuchsia-400/50',
        hoverText: 'hover:text-fuchsia-200',
        hoverBg: 'hover:bg-fuchsia-400/5',
    },
    dashboard: {
        text: 'text-gray-200',
        bg: 'bg-gray-200/10',
        border: 'border-gray-200',
        ring: 'focus-within:ring-gray-200/50',
        hoverText: 'hover:text-white',
        hoverBg: 'hover:bg-gray-200/5',
    },
    'select-org': {
        text: 'text-gray-200',
        bg: 'bg-gray-200/10',
        border: 'border-gray-200',
        ring: 'focus-within:ring-gray-200/50',
        hoverText: 'hover:text-white',
        hoverBg: 'hover:bg-gray-200/5',
    },
    knowledge: {
        text: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400',
        ring: 'focus-within:ring-blue-400/50',
        hoverText: 'hover:text-blue-200',
        hoverBg: 'hover:bg-blue-400/5',
    },
    onboarding: {
        text: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400',
        ring: 'focus-within:ring-purple-400/50',
        hoverText: 'hover:text-purple-200',
        hoverBg: 'hover:bg-purple-400/5',
    },
    showroom: {
        text: 'text-indigo-400',
        bg: 'bg-indigo-400/10',
        border: 'border-indigo-400',
        ring: 'focus-within:ring-indigo-400/50',
        hoverText: 'hover:text-indigo-200',
        hoverBg: 'hover:bg-indigo-400/5',
    }
};

export const getColorForModule = (moduleId: AppSlice['currentModule']): ModuleColor => {
    return moduleColors[moduleId] || moduleColors.dashboard;
};
