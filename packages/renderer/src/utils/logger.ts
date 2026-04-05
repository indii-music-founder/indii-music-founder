/**
 * Safe Logger Utility
 * Wraps console methods to prevent leaking sensitive information in production.
 */

const isDev = typeof import.meta.env !== 'undefined' ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';

export const logger = {
    /**
     * Log an error safely.
     * In development: Logs full error object and stack trace.
     * In production: Logs only the message (and name if available) to avoid leaking internals.
     */
    error: (message: string, ...args: unknown[]) => {
        if (isDev) {
            console.error(message, ...args);
        } else {
            // Production: Sanitize error output
            const sanitizedArgs = args.map(arg => {
                if (arg instanceof Error) {
                    return `${arg.name}: ${arg.message}`;
                } else if (typeof arg === 'string') {
                    return arg;
                } else if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return '[Circular/Unserializable Object]';
                    }
                }
                return 'Unknown error';
            });
            console.error(message, ...sanitizedArgs);
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
