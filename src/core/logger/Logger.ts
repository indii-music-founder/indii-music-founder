import { Sentry } from '@/lib/sentry';

/**
 * Standard Application Logger
 * 
 * Centralizes logging to ensure consistent formatting and Sentry integration.
 * - In Development: Logs to console
 * - In Production: Logs to console (info/warn/error) and sends structured data to Sentry
 */
class LoggerService {
    private isDev = import.meta.env.DEV;

    private formatMessage(module: string, message: string): string {
        return `[${module}] ${message}`;
    }

    /**
     * Debug logs - Only visible in Development
     */
    debug(module: string, message: string, data?: any) {
        if (this.isDev) {
            console.debug(this.formatMessage(module, message), data !== undefined ? data : '');
        }
    }

    /**
     * Info logs - General operational events
     */
    info(module: string, message: string, data?: any) {
        console.info(this.formatMessage(module, message), data !== undefined ? data : '');

        // Add breadcrumb for context in case of future errors
        try {
            Sentry.addBreadcrumb({
                category: module,
                message: message,
                level: 'info',
                data
            });
        } catch (e) {
            // Fail silently if Sentry not initialized
        }
    }

    /**
     * Warn logs - Non-critical issues
     */
    warn(module: string, message: string, data?: any) {
        console.warn(this.formatMessage(module, message), data !== undefined ? data : '');

        try {
            Sentry.addBreadcrumb({
                category: module,
                message: message,
                level: 'warning',
                data
            });
        } catch (e) {
            // Fail silently
        }
    }

    /**
     * Error logs - Critical failures
     * Automatically captures exception in Sentry
     */
    error(module: string, message: string, error?: any) {
        console.error(this.formatMessage(module, message), error !== undefined ? error : '');

        try {
            Sentry.captureException(error instanceof Error ? error : new Error(message), {
                tags: { module },
                extra: {
                    contextMessage: message,
                    rawError: error
                }
            });
        } catch (e) {
            // Fail silently
        }
    }
}

export const Logger = new LoggerService();
