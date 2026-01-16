import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ThreeDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
}

export const ThreeDButton = ({ children, className, variant = 'primary', isLoading = false, disabled, ...props }: ThreeDButtonProps) => {

    const variants = {
        primary: "bg-white text-black border-b-4 border-gray-300 active:border-b-0 active:translate-y-1",
        secondary: "bg-gray-800 text-white border-b-4 border-gray-950 active:border-b-0 active:translate-y-1",
        danger: "bg-red-500 text-white border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
        ghost: "bg-transparent text-white border-b-4 border-transparent active:border-b-0 active:translate-y-1 hover:bg-white/5",
    };

    // When disabled or loading, we shouldn't have the active press effect (border-b-0 translate-y-1)
    // We should keep the border to maintain height but stop the movement
    const disabledStyles = "opacity-50 cursor-not-allowed active:border-b-4 active:translate-y-0";

    return (
        <button
            className={cn(
                "relative px-6 py-3 rounded-xl font-bold transition-all duration-100 outline-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                variants[variant],
                (disabled || isLoading) && disabledStyles,
                className
            )}
            disabled={disabled || isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {children}
                </span>
            ) : (
                children
            )}
        </button>
    );
};
