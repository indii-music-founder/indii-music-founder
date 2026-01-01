import React from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { getColorForModule } from '@/core/theme/moduleColors';
import type { ModuleId } from '@/core/constants';

interface DeptLoaderProps {
    /** Loading message to display */
    message?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Optional moduleId override - defaults to current module */
    moduleId?: ModuleId;
    /** Full page overlay mode */
    fullPage?: boolean;
    /** Show the pulsing border animation */
    showPulse?: boolean;
}

/**
 * DeptLoader - Department-themed loading indicator
 *
 * Uses the indii-auto-update animation with department colors.
 * Automatically inherits color from current module context.
 *
 * @example
 * // Basic usage - inherits current module color
 * <DeptLoader message="Loading campaigns..." />
 *
 * // Full page overlay
 * <DeptLoader message="Processing..." fullPage />
 *
 * // Specific department color
 * <DeptLoader moduleId="finance" message="Fetching royalties..." />
 */
export function DeptLoader({
    message = 'Loading...',
    size = 'md',
    moduleId: propModuleId,
    fullPage = false,
    showPulse = true
}: DeptLoaderProps) {
    const currentModule = useStore((state) => state.currentModule);
    const moduleId = propModuleId || currentModule;
    const colors = getColorForModule(moduleId);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-10 h-10'
    };

    const textSizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    const content = (
        <div
            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
            className={`
                flex flex-col items-center justify-center gap-3 p-6 rounded-lg
                ${showPulse ? 'indii-auto-update' : ''}
                ${fullPage ? 'bg-[#0d1117]/90 backdrop-blur-sm' : ''}
            `}
        >
            <Loader2
                className={`${sizeClasses[size]} ${colors.text} animate-spin drop-shadow-[0_0_8px_var(--dept-color)]`}
            />
            {message && (
                <p className={`${textSizes[size]} text-gray-400 font-main`}>
                    {message}
                </p>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                {content}
            </div>
        );
    }

    return content;
}

/**
 * DeptSkeleton - Department-themed skeleton placeholder
 *
 * Animated placeholder for loading content with department color accent.
 */
interface DeptSkeletonProps {
    /** Width of the skeleton (Tailwind class or CSS value) */
    width?: string;
    /** Height of the skeleton (Tailwind class or CSS value) */
    height?: string;
    /** Optional moduleId override */
    moduleId?: ModuleId;
    /** Additional class names */
    className?: string;
}

export function DeptSkeleton({
    width = 'w-full',
    height = 'h-4',
    moduleId: propModuleId,
    className = ''
}: DeptSkeletonProps) {
    const currentModule = useStore((state) => state.currentModule);
    const moduleId = propModuleId || currentModule;
    const colors = getColorForModule(moduleId);

    return (
        <div
            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
            className={`
                ${width} ${height} ${className}
                rounded bg-gray-800/50 relative overflow-hidden
            `}
        >
            <div
                className="absolute inset-0 animate-pulse"
                style={{
                    background: `linear-gradient(90deg, transparent, var(--dept-color, #ffffff10), transparent)`,
                    animation: 'shimmer 1.5s infinite'
                }}
            />
        </div>
    );
}

/**
 * DeptCardSkeleton - Department-themed card skeleton
 *
 * Full card placeholder with department accent.
 */
export function DeptCardSkeleton({ moduleId }: { moduleId?: ModuleId }) {
    return (
        <div className="bg-[#161b22]/50 rounded-xl p-5 dept-border-top space-y-3">
            <DeptSkeleton width="w-10" height="h-10" moduleId={moduleId} className="rounded-lg" />
            <DeptSkeleton width="w-3/4" height="h-4" moduleId={moduleId} />
            <DeptSkeleton width="w-1/2" height="h-3" moduleId={moduleId} />
        </div>
    );
}
