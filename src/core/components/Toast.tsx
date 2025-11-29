import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const icons = {
        success: <CheckCircle size={18} className="text-green-400" />,
        error: <AlertCircle size={18} className="text-red-400" />,
        info: <Info size={18} className="text-blue-400" />
    };

    const bgColors = {
        success: 'bg-green-900/20 border-green-900/50',
        error: 'bg-red-900/20 border-red-900/50',
        info: 'bg-blue-900/20 border-blue-900/50'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl min-w-[300px] ${bgColors[toast.type]}`}
        >
            {icons[toast.type]}
            <p className="flex-1 text-sm font-medium text-gray-200">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
};
