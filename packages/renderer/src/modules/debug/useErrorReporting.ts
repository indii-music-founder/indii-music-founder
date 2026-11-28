import { useEffect } from 'react';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

/** How long a captured uncaught error stays eligible to pre-fill a bug report. */
export const RECENT_ERROR_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 500;

export interface CapturedError {
    message: string;
    module: string;
    capturedAt: number;
}

let lastError: CapturedError | null = null;

function describe(reason: unknown, fallback: string): string {
    const text = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : fallback;
    return text.trim().slice(0, MAX_MESSAGE_LENGTH) || fallback;
}

export function recordUncaughtError(reason: unknown, fallback: string, now: number = Date.now()): void {
    lastError = {
        message: describe(reason, fallback),
        module: useStore.getState().currentModule ?? '',
        capturedAt: now,
    };
}

/** The most recent uncaught error, if it happened within the reporting window. */
export function getRecentUncaughtError(now: number = Date.now()): CapturedError | null {
    if (!lastError || now - lastError.capturedAt > RECENT_ERROR_WINDOW_MS) return null;
    return lastError;
}

export function clearRecentUncaughtError(): void {
    lastError = null;
}

/**
 * Captures uncaught errors and unhandled rejections so that opening
 * "Report a bug" (Ctrl+Shift+B or the command menu) pre-fills the error and
 * the module it happened in. Mount once at the app root.
 */
export const useErrorReporting = () => {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            logger.error('[useErrorReporting] Uncaught error:', event.error ?? event.message);
            recordUncaughtError(event.error ?? event.message, 'Uncaught script error');
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            logger.error('[useErrorReporting] Unhandled promise rejection:', event.reason);
            recordUncaughtError(event.reason, 'Unhandled promise rejection');
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);
};
