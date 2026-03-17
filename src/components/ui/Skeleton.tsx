/**
 * Item 287: Loading Skeleton Screens
 *
 * Replaces `isLoading ? null : <Content/>` anti-patterns with placeholder
 * components that match the shape of real content — eliminating layout shift
 * and reducing perceived load time.
 *
 * Usage:
 *   <Skeleton className="h-8 w-40" />
 *   <SkeletonCard />
 *   <SkeletonTable rows={5} />
 *   <SkeletonStatPanel />
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

// ── Base pulse skeleton ──────────────────────────────────────────────────────

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={cn('animate-pulse rounded-md bg-white/5', className)}
        />
    );
}

// ── Stat card (e.g. "Streams Today", "Revenue MTD") ─────────────────────────

export function SkeletonStat() {
    return (
        <div aria-hidden="true" className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-lg" />
                <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-36" />
        </div>
    );
}

// ── Table rows ───────────────────────────────────────────────────────────────

interface SkeletonTableProps {
    rows?: number;
    cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
    return (
        <div aria-hidden="true" className="space-y-2">
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b border-white/5">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-3 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, row) => (
                <div key={row} className="flex gap-4 py-2">
                    {Array.from({ length: cols }).map((_, col) => (
                        <Skeleton
                            key={col}
                            className={cn('h-4 flex-1', col === 0 ? 'w-32' : '')}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Dashboard panel (left sidebar quick-stats) ───────────────────────────────

export function SkeletonStatPanel() {
    return (
        <div aria-hidden="true" className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStat key={i} />
            ))}
        </div>
    );
}

// ── Card grid (e.g. release cards, campaign tiles) ───────────────────────────

interface SkeletonCardGridProps {
    count?: number;
}

export function SkeletonCardGrid({ count = 6 }: SkeletonCardGridProps) {
    return (
        <div aria-hidden="true" className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white/3 border border-white/5 p-4 space-y-3">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    );
}

// ── List items (e.g. agent history, track list) ───────────────────────────────

interface SkeletonListProps {
    rows?: number;
}

export function SkeletonList({ rows = 5 }: SkeletonListProps) {
    return (
        <div aria-hidden="true" className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/3">
                    <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                </div>
            ))}
        </div>
    );
}

// ── Text block (e.g. contracts, descriptions) ────────────────────────────────

interface SkeletonTextProps {
    lines?: number;
}

export function SkeletonText({ lines = 3 }: SkeletonTextProps) {
    return (
        <div aria-hidden="true" className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
                />
            ))}
        </div>
    );
}
