import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast, ToastMessage, ToastType } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';

interface ToastContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastType, duration?: number) => {
        const id = uuidv4();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const contextValue = {
        showToast: addToast,
        success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
        error: (msg: string, dur?: number) => addToast(msg, 'error', dur),
        info: (msg: string, dur?: number) => addToast(msg, 'info', dur),
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 items-end pointer-events-auto">
                    <AnimatePresence>
                        {toasts.map(toast => (
                            <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </ToastContext.Provider>
    );
};
