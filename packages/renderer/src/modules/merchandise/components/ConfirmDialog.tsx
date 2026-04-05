import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { MerchButton } from './MerchButton';

export interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger'
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                    variant === 'danger' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                    <AlertTriangle className={variant === 'danger' ? 'text-red-400' : 'text-yellow-400'} size={24} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>

                {/* Message */}
                <p className="text-sm text-neutral-400 mb-6">{message}</p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                            variant === 'danger'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
