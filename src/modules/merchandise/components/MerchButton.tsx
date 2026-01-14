import React from 'react';
import { cn } from '@/lib/utils';

interface MerchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    glow?: boolean;
}

export const MerchButton = React.forwardRef<HTMLButtonElement, MerchButtonProps>(
    ({ className, variant = 'primary', size = 'md', glow = false, children, ...props }, ref) => {
    loading?: boolean;
    fullWidth?: boolean;
}

export const MerchButton = React.forwardRef<HTMLButtonElement, MerchButtonProps>(
    ({ className, variant = 'primary', size = 'md', glow = false, loading = false, fullWidth = false, children, disabled, ...props }, ref) => {

        const baseStyles = "font-bold tracking-tight rounded-md transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";

        const variants = {
            primary: "bg-[#FFE135] text-black hover:bg-[#FFD700] border border-[#FFE135]",
            secondary: "bg-neutral-800 text-yellow-400 hover:bg-neutral-700 border border-neutral-700",
            outline: "bg-transparent text-[#FFE135] border border-[#FFE135] hover:bg-[#FFE135]/10",
            ghost: "bg-transparent text-neutral-400 hover:text-[#FFE135] hover:bg-neutral-800/50"
            primary: "bg-yellow-400 text-black hover:bg-yellow-500 border border-yellow-400 shadow-lg shadow-yellow-400/20",
            secondary: "bg-neutral-800 text-yellow-500 hover:bg-neutral-700 border border-neutral-700",
            outline: "bg-transparent text-yellow-400 border border-yellow-400 hover:bg-yellow-400/10",
            ghost: "bg-transparent text-neutral-400 hover:text-yellow-400 hover:bg-neutral-800/50"
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-12 px-6 text-base"
        };

        const glowEffect = glow ? "shadow-[0_0_15px_rgba(255,225,53,0.3)] hover:shadow-[0_0_25px_rgba(255,225,53,0.5)]" : "";
        const glowEffect = glow ? "shadow-[0_0_15px_rgba(250,204,21,0.3)] hover:shadow-[0_0_25px_rgba(250,204,21,0.5)]" : "";
        const widthStyle = fullWidth ? "w-full" : "";

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], glowEffect, className)}
                {...props}
            >
                disabled={disabled || loading}
                className={cn(baseStyles, variants[variant], sizes[size], glowEffect, widthStyle, className)}
                {...props}
            >
                {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

MerchButton.displayName = "MerchButton";
