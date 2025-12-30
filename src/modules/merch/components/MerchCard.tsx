import React from 'react';
import { cn } from '@/utils/classNameUtils';

interface MerchCardProps extends React.HTMLAttributes<HTMLDivElement> {
    active?: boolean;
    hoverEffect?: boolean;
}

export const MerchCard = React.forwardRef<HTMLDivElement, MerchCardProps>(
    ({ className, active = false, hoverEffect = true, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative overflow-hidden rounded-xl bg-neutral-900/40 backdrop-blur-md border border-white/5",
                    hoverEffect && "transition-all duration-300 hover:bg-neutral-800/40 hover:border-yellow-400/20 hover:shadow-[0_4px_20px_-10px_rgba(255,225,53,0.1)]",
                    active && "border-yellow-500/50 bg-neutral-800/40 shadow-[0_0_15px_rgba(255,225,53,0.15)]",
                    className
                )}
                {...props}
            >
                {/* Subtle sheen layer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                {/* Content */}
                <div className="relative z-10 w-full h-full">
                    {children}
                </div>
            </div>
        );
    }
);

MerchCard.displayName = "MerchCard";
