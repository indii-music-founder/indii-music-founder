import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    progress?: number; // 0-100 for loading toasts
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    useEffect(() => {
        // Loading toasts don't auto-dismiss
        if (toast.type === 'loading') return;

        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const icons = {
        success: <CheckCircle size={18} className="text-green-400" />,
        error: <AlertCircle size={18} className="text-red-400" />,
        info: <Info size={18} className="text-blue-400" />,
        warning: <AlertTriangle size={18} className="text-yellow-400" />,
        loading: <Loader2 size={18} className="text-purple-400 animate-spin" />
    };

    const bgColors = {
        success: 'bg-green-900/20 border-green-900/50',
        error: 'bg-red-900/20 border-red-900/50',
        info: 'bg-blue-900/20 border-blue-900/50',
        warning: 'bg-yellow-900/20 border-yellow-900/50',
        loading: 'bg-purple-900/20 border-purple-900/50'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`flex flex-col gap-2 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl min-w-[300px] ${bgColors[toast.type]}`}
        >
            <div className="flex items-center gap-3">
                {icons[toast.type]}
                <p className="flex-1 text-sm font-medium text-gray-200">{toast.message}</p>
                {toast.type !== 'loading' && (
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            {toast.type === 'loading' && toast.progress !== undefined && (
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                        className="h-full bg-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${toast.progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            )}
        </motion.div>
    );
};
