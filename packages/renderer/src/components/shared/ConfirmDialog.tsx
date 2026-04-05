import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Item 291: Reusable Destructive Action Confirmation Dialog
 *
 * Wraps Radix Dialog to provide a consistent confirm/cancel UI
 * for irreversible actions (delete release, remove collaborator, cancel subscription, etc.).
 */

export interface ConfirmDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Called when the dialog should close (cancel or backdrop click) */
    onOpenChange: (open: boolean) => void;
    /** Called when the user confirms the destructive action */
    onConfirm: () => void | Promise<void>;
    /** Dialog title */
    title: string;
    /** Description/body text explaining the consequences */
    description: string;
    /** Text for the confirm button (default: "Delete") */
    confirmLabel?: string;
    /** Text for the cancel button (default: "Cancel") */
    cancelLabel?: string;
    /** Visual variant — determines icon and button color */
    variant?: 'danger' | 'warning';
    /** Whether the confirm action is currently loading */
    loading?: boolean;
}

const variantConfig = {
    danger: {
        icon: Trash2,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-400',
        confirmBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        confirmBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
};

export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    variant = 'danger',
    loading = false,
}: ConfirmDialogProps) {
    const config = variantConfig[variant];
    const Icon = config.icon;

    const handleConfirm = useCallback(async () => {
        await onConfirm();
        onOpenChange(false);
    }, [onConfirm, onOpenChange]);

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in-0"
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                        'w-full max-w-md p-6 rounded-xl',
                        'bg-gray-900 border border-gray-700 shadow-2xl',
                        'animate-in fade-in-0 zoom-in-95 duration-200',
                        'focus:outline-none'
                    )}
                    aria-describedby="confirm-dialog-description"
                >
                    {/* Icon + Title */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn('flex items-center justify-center w-12 h-12 rounded-full', config.iconBg)}>
                            <Icon className={cn('w-6 h-6', config.iconColor)} />
                        </div>
                        <div className="flex-1">
                            <DialogPrimitive.Title className="text-lg font-semibold text-white">
                                {title}
                            </DialogPrimitive.Title>
                        </div>
                    </div>

                    {/* Description */}
                    <DialogPrimitive.Description
                        id="confirm-dialog-description"
                        className="text-sm text-gray-400 mb-6 leading-relaxed"
                    >
                        {description}
                    </DialogPrimitive.Description>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <DialogPrimitive.Close
                            className={cn(
                                'px-4 py-2 text-sm font-medium rounded-lg',
                                'bg-gray-800 text-gray-300 border border-gray-600',
                                'hover:bg-gray-700 hover:text-white',
                                'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900',
                                'transition-colors duration-150'
                            )}
                        >
                            {cancelLabel}
                        </DialogPrimitive.Close>

                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className={cn(
                                'px-4 py-2 text-sm font-medium rounded-lg text-white',
                                config.confirmBg,
                                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
                                'transition-colors duration-150',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                confirmLabel
                            )}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/**
 * Hook for managing ConfirmDialog state.
 *
 * Usage:
 * ```tsx
 * const confirm = useConfirmDialog();
 *
 * <button onClick={() => confirm.open()}>Delete</button>
 * <ConfirmDialog
 *   open={confirm.isOpen}
 *   onOpenChange={confirm.setIsOpen}
 *   onConfirm={handleDelete}
 *   title="Delete Release"
 *   description="This action cannot be undone."
 * />
 * ```
 */
export function useConfirmDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    return { isOpen, setIsOpen, open, close };
}
