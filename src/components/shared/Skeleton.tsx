import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className,
    variant = 'rectangular',
    ...props
}) => {
    return (
        <div
            className={cn(
                "animate-pulse bg-white/5 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
                variant === 'text' && "h-4 w-full rounded",
                variant === 'circular' && "rounded-full",
                variant === 'rectangular' && "rounded-xl",
                className
            )}
            {...props}
        />
    );
};

export const PostSkeleton: React.FC = () => (
    <div className="p-4 border-b border-white/5 space-y-4">
        <div className="flex gap-4">
            <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-16 h-3" />
                </div>
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-3/4 h-4" />
            </div>
        </div>
    </div>
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
            <Skeleton className="w-32 h-6" />
            <Skeleton variant="circular" className="w-8 h-8" />
        </div>
        <Skeleton className="w-full h-32" />
        <div className="space-y-2">
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-2/3 h-4" />
        </div>
    </div>
);
