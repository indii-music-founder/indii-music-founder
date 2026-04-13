import { logger } from '@/utils/logger';

/**
 * Standard Application Logger
 *
 * Centralizes logging to ensure consistent formatting and Sentry integration.
 * - In Development: Logs to console with human-readable format
 * - In Production: Logs structured JSON for log aggregation + sends to Sentry
 *
 * IMPORTANT: This module deliberately does NOT statically import '@/lib/sentry'.
 * The sentry module re-exports Logger indirectly, creating a circular dependency
 * that silently kills the production bundle during module evaluation.
 * Instead, Sentry is accessed lazily via getSentry() which is called only at
 * runtime — after all modules have finished evaluating.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryLike = Record<string, any>;

/**
 * Lazy Sentry accessor — returns the Sentry namespace only after all modules
 * have fully evaluated, preventing the circular-import silent crash.
 */
function getSentry(): SentryLike | null {
    try {
        // `window.__sentryInstance` is populated by sentry.ts after it initializes
        return (window as unknown as { __sentryInstance?: SentryLike }).__sentryInstance ?? null;
    } catch {
        return null;
    }
}

class LoggerService {
    private isDev = typeof import.meta.env !== 'undefined' ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
    private isProd = typeof import.meta.env !== 'undefined' ? import.meta.env.PROD : process.env.NODE_ENV === 'production';

    private formatMessage(module: string, message: string): string {
        return `[${module}] ${message}`;
    }

    private structuredLog(level: string, module: string, message: string, data?: unknown) {
        if (!this.isProd) return;
        const entry = {
            timestamp: new Date().toISOString(),
            severity: level.toUpperCase(),
            module,
            message,
            ...(data !== undefined && { data }),
        };
        // Use appropriate console method for structured output
        const fn = level === 'warn' ? console.warn : level === 'error' ? console.error : console.info;
        fn(JSON.stringify(entry));
    }

    /**
     * Debug logs - Only visible in Development
     */
    debug(module: string, message: string, data?: unknown) {
        if (this.isDev) {
            console.debug(this.formatMessage(module, message), data !== undefined ? data : '');
        }
    }

    /**
     * Info logs - General operational events
     */
    info(module: string, message: string, data?: unknown) {
        if (this.isDev) {
            console.info(this.formatMessage(module, message), data !== undefined ? data : '');
        }
        this.structuredLog('info', module, message, data);

        try {
            getSentry()?.addBreadcrumb({
                category: module,
                message: message,
                level: 'info',
                data: data as Record<string, unknown>
            });
        } catch {
            // Fail silently if Sentry not initialized
        }
    }

    /**
     * Warn logs - Non-critical issues
     */
    warn(module: string, message: string, data?: unknown) {
        if (this.isDev) {
            logger.warn(this.formatMessage(module, message), data !== undefined ? data : '');
        }
        this.structuredLog('warn', module, message, data);

        try {
            getSentry()?.addBreadcrumb({
                category: module,
                message: message,
                level: 'warning',
                data: data as Record<string, unknown>
            });
        } catch {
            // Fail silently
        }
    }

    /**
     * Error logs - Critical failures
     * Automatically captures exception in Sentry
     */
    error(module: string, message: string, error?: unknown) {
        if (this.isDev) {
            logger.error(this.formatMessage(module, message), error !== undefined ? error : '');
        }
        this.structuredLog('error', module, message, error instanceof Error ? error.message : error);

        try {
            const sentry = getSentry();
            if (sentry) {
                sentry.captureException(error instanceof Error ? error : new Error(message), {
                    tags: { module },
                    extra: {
                        contextMessage: message,
                        rawError: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        } catch {
            // Fail silently
        }
    }
}

export const Logger = new LoggerService();
