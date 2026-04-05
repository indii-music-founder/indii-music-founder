import React from 'react';
import { motion } from 'motion/react';
import { Inbox, Music, Megaphone, MapPin, ShoppingBag, BarChart3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Item 286: Reusable Empty State Component
 *
 * Displays a meaningful empty state with icon, headline, description, and optional CTA
 * when a data panel has no content. Used across all modules to replace blank divs.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon="music"
 *   title="No tracks yet"
 *   description="Upload your first track to get started."
 *   action={{ label: "Upload Track", onClick: handleUpload }}
 * />
 * ```
 */

const iconMap = {
    inbox: Inbox,
    music: Music,
    megaphone: Megaphone,
    mapPin: MapPin,
    shoppingBag: ShoppingBag,
    chart: BarChart3,
    document: FileText,
} as const;

type IconName = keyof typeof iconMap;

export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}

export interface EmptyStateProps {
    /** Icon to display — choose from preset icons or pass a custom React node */
    icon?: IconName | React.ReactNode;
    /** Main headline */
    title: string;
    /** Supporting description text */
    description?: string;
    /** Primary call-to-action button */
    action?: EmptyStateAction;
    /** Secondary call-to-action button */
    secondaryAction?: EmptyStateAction;
    /** Additional CSS classes for the container */
    className?: string;
    /** Whether to use the compact variant (smaller icon, less padding) */
    compact?: boolean;
}

export function EmptyState({
    icon = 'inbox',
    title,
    description,
    action,
    secondaryAction,
    className,
    compact = false,
}: EmptyStateProps) {
    const IconComponent = typeof icon === 'string' ? iconMap[icon as IconName] : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-8 px-6' : 'py-16 px-8',
                className
            )}
        >
            {/* Icon */}
            <div
                className={cn(
                    'flex items-center justify-center rounded-2xl bg-white/5 border border-white/10',
                    compact ? 'w-14 h-14 mb-4' : 'w-20 h-20 mb-6'
                )}
            >
                {IconComponent ? (
                    <IconComponent
                        className={cn('text-gray-500', compact ? 'w-6 h-6' : 'w-8 h-8')}
                        strokeWidth={1.5}
                    />
                ) : (
                    // Custom icon passed as React node
                    <span className={cn('text-gray-500', compact ? 'w-6 h-6' : 'w-8 h-8')}>
                        {icon}
                    </span>
                )}
            </div>

            {/* Title */}
            <h3
                className={cn(
                    'font-semibold text-white',
                    compact ? 'text-base mb-1' : 'text-lg mb-2'
                )}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    className={cn(
                        'text-gray-400 max-w-sm leading-relaxed',
                        compact ? 'text-xs mb-4' : 'text-sm mb-6'
                    )}
                >
                    {description}
                </p>
            )}

            {/* Actions */}
            {(action || secondaryAction) && (
                <div className="flex items-center gap-3">
                    {action && (
                        <button
                            onClick={action.onClick}
                            className={cn(
                                'px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                                action.variant === 'secondary'
                                    ? 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    : 'bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/5'
                            )}
                        >
                            {action.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-200"
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
}
