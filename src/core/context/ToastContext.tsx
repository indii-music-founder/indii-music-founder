import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast, ToastMessage, ToastType } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';
import { events } from '../events';

interface ToastContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    loading: (message: string) => string; // Returns toast ID for updating/dismissing
    updateProgress: (id: string, progress: number, message?: string) => void;
    dismiss: (id: string) => void;
    promise: <T>(
        promise: Promise<T>,
        messages: { loading: string; success: string; error: string }
    ) => Promise<T>;
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
    // ToastProvider Rendering
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastType, duration?: number, progress?: number) => {
        const id = uuidv4();
        setToasts(prev => [...prev, { id, message, type, duration, progress }]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const updateToast = useCallback((id: string, updates: Partial<ToastMessage>) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    useEffect(() => {
        const handleAlert = (data: any) => {
            const type = data.level === 'error' ? 'error' :
                data.level === 'warning' ? 'warning' :
                    data.level === 'success' ? 'success' : 'info';
            addToast(data.message, type);
        };

        events.on('SYSTEM_ALERT', handleAlert);
        return () => events.off('SYSTEM_ALERT', handleAlert);
    }, [addToast]);

    const loadingToast = useCallback((message: string) => {
        return addToast(message, 'loading', undefined, 0);
    }, [addToast]);

    const updateProgress = useCallback((id: string, progress: number, message?: string) => {
        updateToast(id, { progress, ...(message ? { message } : {}) });
    }, [updateToast]);

    const promiseToast = useCallback(async <T,>(
        promise: Promise<T>,
        messages: { loading: string; success: string; error: string }
    ): Promise<T> => {
        const id = addToast(messages.loading, 'loading');
        try {
            const result = await promise;
            removeToast(id);
            addToast(messages.success, 'success');
            return result;
        } catch (error) {
            removeToast(id);
            addToast(messages.error, 'error');
            throw error;
        }
    }, [addToast, removeToast]);

    // Helpers need to be stable too, though they are usually just wrappers around addToast
    const success = useCallback((msg: string, dur?: number) => { addToast(msg, 'success', dur); }, [addToast]);
    const error = useCallback((msg: string, dur?: number) => { addToast(msg, 'error', dur); }, [addToast]);
    const info = useCallback((msg: string, dur?: number) => { addToast(msg, 'info', dur); }, [addToast]);
    const warning = useCallback((msg: string, dur?: number) => { addToast(msg, 'warning', dur); }, [addToast]);

    const contextValue: ToastContextType = useMemo(() => ({
        showToast: addToast,
        success,
        error,
        info,
        warning,
        loading: loadingToast,
        updateProgress,
        dismiss: removeToast,
        promise: promiseToast,
    }), [addToast, success, error, info, warning, loadingToast, updateProgress, removeToast, promiseToast]);

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
