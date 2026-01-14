export interface MerchTheme {
    name: string;
    colors: {
        background: string;
        surface: string;
        surfaceHighlight: string;
        border: string;
        text: string;
        textSecondary: string;
        accent: string;
        accentGlow: string;
    };
    effects: {
        glass: string;
        glow: string;
        shadow: string;
        borderRadius: string;
    };
}

export const StandardTheme: MerchTheme = {
    name: 'Standard',
    colors: {
        background: 'bg-[#FFF9E5]', // Creamy light yellow
        surface: 'bg-[#FFEBA0]', // Light yellow surface
        surfaceHighlight: 'bg-[#FFF2C0]',
        border: 'border-yellow-200',
        text: 'text-yellow-900',
        textSecondary: 'text-yellow-800/70',
        background: 'bg-neutral-50',
        surface: 'bg-white',
        surfaceHighlight: 'bg-neutral-100',
        border: 'border-neutral-200',
        text: 'text-neutral-900',
        textSecondary: 'text-neutral-500',
        accent: 'text-yellow-600',
        accentGlow: 'shadow-yellow-500/20',
    },
    effects: {
        glass: 'backdrop-blur-sm bg-opacity-90',
        glow: 'shadow-lg shadow-yellow-900/5',
        shadow: 'shadow-md',
        borderRadius: 'rounded-3xl',
    },
};

export const ProTheme: MerchTheme = {
    name: 'Pro',
    colors: {
        background: 'bg-black',
        surface: 'bg-gray-900/60',
        surfaceHighlight: 'bg-white/10',
        border: 'border-white/10',
        text: 'text-white',
        textSecondary: 'text-gray-400',
        accent: 'text-yellow-400',
        accentGlow: 'shadow-yellow-400/50',
    },
    effects: {
        glass: 'backdrop-blur-xl bg-opacity-40',
        glow: 'shadow-[0_0_20px_rgba(255,200,0,0.1)]',
        shadow: 'shadow-2xl shadow-black/40',
        borderRadius: 'rounded-xl',
    },
};

export const THEMES = {
    standard: StandardTheme,
    pro: ProTheme,
};
