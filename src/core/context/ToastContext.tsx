import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { Toast, ToastMessage, ToastType } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';
import { events } from '../events';

/** Alert data from system events */
interface AlertData {
    level: 'error' | 'warning' | 'success' | 'info';
    message: string;
}

/** Toast context API available via useToast hook */
export interface ToastContextType {
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
    const MAX_TOASTS = 3; // Item 289: Reduced from 5 to 3 for cleaner UX

    // Item 289: Deduplication — track recent messages to prevent duplicates within 2s window
    const recentMessages = useRef<Map<string, number>>(new Map());
    const DEDUP_WINDOW_MS = 2000;

    const isDuplicate = useCallback((message: string, type: ToastType): boolean => {
        const key = `${type}:${message}`;
        const lastShown = recentMessages.current.get(key);
        if (lastShown && Date.now() - lastShown < DEDUP_WINDOW_MS) {
            return true;
        }
        recentMessages.current.set(key, Date.now());
        // Clean old entries periodically
        if (recentMessages.current.size > 50) {
            const cutoff = Date.now() - DEDUP_WINDOW_MS;
            for (const [k, v] of recentMessages.current) {
                if (v < cutoff) recentMessages.current.delete(k);
            }
        }
        return false;
    }, []);

    const addToast = useCallback((message: string, type: ToastType, duration?: number, progress?: number) => {
        // Item 289: Skip duplicate messages within the dedup window
        if (isDuplicate(message, type)) return '';

        const id = uuidv4();
        setToasts(prev => {
            const next = [...prev, { id, message, type, duration, progress }];
            return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
        });
        return id;
    }, [isDuplicate]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const updateToast = useCallback((id: string, updates: Partial<ToastMessage>) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    useEffect(() => {
        const handleAlert = (data: AlertData) => {
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
            {/* Item 342: aria-live="assertive" for error toasts, "polite" for informational */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <div role="status" aria-live="assertive" aria-label="Error notifications" className="flex flex-col gap-2 items-end pointer-events-auto">
                    <AnimatePresence>
                        {toasts.filter(t => t.type === 'error').map(toast => (
                            <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
                        ))}
                    </AnimatePresence>
                </div>
                <div role="status" aria-live="polite" aria-label="Notifications" className="flex flex-col gap-2 items-end pointer-events-auto">
                    <AnimatePresence>
                        {toasts.filter(t => t.type !== 'error').map(toast => (
                            <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </ToastContext.Provider>
    );
};

// Singleton helper for non-React context usage (services, etc)
export const toast = {
    success: (message: string, duration?: number) => events.emit('SYSTEM_ALERT', { level: 'success', message }),
    error: (message: string, duration?: number) => events.emit('SYSTEM_ALERT', { level: 'error', message }),
    info: (message: string, duration?: number) => events.emit('SYSTEM_ALERT', { level: 'info', message }),
    warning: (message: string, duration?: number) => events.emit('SYSTEM_ALERT', { level: 'warning', message }),
};
