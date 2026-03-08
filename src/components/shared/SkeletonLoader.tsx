import { cn } from '@/lib/utils';

/**
 * Item 287: Loading Skeleton Screen Components
 *
 * Replace all `isLoading ? null : <Content/>` patterns with visual skeleton
 * placeholders that reduce perceived load time and prevent layout shift.
 *
 * Usage:
 * ```tsx
 * {isLoading ? <SkeletonCard /> : <RealCard data={data} />}
 * ```
 */

interface SkeletonProps {
    className?: string;
}

/**
 * Base skeleton pulse element — use for custom layouts.
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-lg bg-white/5',
                className
            )}
        />
    );
}

/**
 * Skeleton for a single text line.
 */
export function SkeletonLine({ className }: SkeletonProps) {
    return <Skeleton className={cn('h-4 w-full', className)} />;
}

/**
 * Skeleton for a card with title, description, and metadata.
 */
export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'p-5 rounded-xl bg-white/5 border border-white/10 space-y-4',
                className
            )}
        >
            <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
            </div>
        </div>
    );
}

/**
 * Skeleton for a table row with multiple columns.
 */
export function SkeletonTableRow({ columns = 4, className }: SkeletonProps & { columns?: number }) {
    return (
        <div className={cn('flex items-center gap-4 py-3 border-b border-white/5', className)}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        'h-4',
                        i === 0 ? 'w-1/4' : i === columns - 1 ? 'w-16' : 'flex-1'
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton for a list panel (e.g., tracks, releases, campaigns).
 */
export function SkeletonList({ rows = 5, className }: SkeletonProps & { rows?: number }) {
    return (
        <div className={cn('space-y-3', className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-md" />
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton for a stat/metric card.
 */
export function SkeletonStat({ className }: SkeletonProps) {
    return (
        <div className={cn('p-4 rounded-xl bg-white/5 border border-white/10', className)}>
            <Skeleton className="h-3 w-1/2 mb-3" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/3" />
        </div>
    );
}

/**
 * Skeleton for the dashboard grid (stat cards + main content area).
 */
export function SkeletonDashboard({ className }: SkeletonProps) {
    return (
        <div className={cn('space-y-6', className)}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SkeletonCard className="lg:col-span-2" />
                <SkeletonCard />
            </div>
        </div>
    );
}
