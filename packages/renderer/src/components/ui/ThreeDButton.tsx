import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ThreeDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
}

export const ThreeDButton = React.forwardRef<HTMLButtonElement, ThreeDButtonProps>(
    ({ children, className, variant = 'primary', isLoading = false, disabled, type = 'button', ...props }, ref) => {
        const variants = {
            primary: "bg-white text-black border-b-4 border-gray-300 active:border-b-0 active:translate-y-1",
            secondary: "bg-gray-800 text-white border-b-4 border-gray-950 active:border-b-0 active:translate-y-1",
            danger: "bg-red-500 text-white border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
            ghost: "bg-transparent text-white border-b-4 border-transparent active:border-b-0 active:translate-y-1 hover:bg-white/5",
        };

        // When disabled or loading, we shouldn't have the active press effect (border-b-0 translate-y-1)
        // We should keep the border to maintain height but stop the movement
        const disabledStyles = "opacity-50 cursor-not-allowed active:border-b-4 active:translate-y-0";
        const isDisabled = Boolean(disabled || isLoading);

        return (
            <button
                ref={ref}
                type={type}
                className={cn(
                    "relative px-6 py-3 rounded-xl font-bold motion-safe:transition-all duration-100 outline-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    variants[variant],
                    isDisabled && disabledStyles,
                    className
                )}
                {...props}
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-busy={isLoading || undefined}
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                        {children}
                    </span>
                ) : (
                    children
                )}
            </button>
        );
    }
);
ThreeDButton.displayName = 'ThreeDButton';
