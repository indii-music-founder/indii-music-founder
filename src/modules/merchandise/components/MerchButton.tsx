import React from 'react';
import { cn } from '@/lib/utils';

interface MerchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    glow?: boolean;
}

export const MerchButton = React.forwardRef<HTMLButtonElement, MerchButtonProps>(
    ({ className, variant = 'primary', size = 'md', glow = false, children, ...props }, ref) => {

        const baseStyles = "font-bold tracking-tight rounded-md transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";

        const variants = {
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

        const glowEffect = glow ? "shadow-[0_0_15px_rgba(250,204,21,0.3)] hover:shadow-[0_0_25px_rgba(250,204,21,0.5)]" : "";

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], glowEffect, className)}
                {...props}
            >
                {children}
            </button>
        );
    }
);

MerchButton.displayName = "MerchButton";
