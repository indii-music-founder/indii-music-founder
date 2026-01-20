/**
 * Safe Logger Utility
 * Wraps console methods to prevent leaking sensitive information in production.
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log an error safely.
     * In development: Logs full error object and stack trace.
     * In production: Logs only the message (and name if available) to avoid leaking internals.
     */
    error: (message: string, error?: unknown) => {
        if (isDev) {
            console.error(message, error);
        } else {
            // Production: Sanitize error output
            let safeError = 'Unknown error';
            if (error instanceof Error) {
                safeError = `${error.name}: ${error.message}`;
            } else if (typeof error === 'string') {
                safeError = error;
            } else if (typeof error === 'object' && error !== null) {
                try {
                    safeError = JSON.stringify(error);
                } catch {
                    safeError = '[Circular/Unserializable Object]';
                }
            }
            console.error(message, safeError);
        }
    },

    /**
     * Log a warning.
     */
    warn: (message: string, ...args: unknown[]) => {
        console.warn(message, ...args);
    },

    /**
     * Log info.
     */
    info: (message: string, ...args: unknown[]) => {
        console.info(message, ...args);
    },

    /**
     * Log debug info (only in dev).
     */
    debug: (message: string, ...args: unknown[]) => {
        if (isDev) {
            console.debug(message, ...args);
        }
    }
};
