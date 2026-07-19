import { useEffect } from 'react';
import { useBugReport } from './useBugReport';
import { logger } from '@/utils/logger';

/**
 * Hook to automatically integrate with error handling for bug reporting
 * Listens for uncaught errors and allows users to report them
 *
 * Usage:
 * ```tsx
 * export const App = () => {
 *   useErrorReporting();
 *   return <div>...</div>;
 * };
 * ```
 */
export const useErrorReporting = () => {
    const { reportBug } = useBugReport();

    useEffect(() => {
        // Catch global errors
        const handleError = (event: ErrorEvent) => {
            logger.error('[useErrorReporting] Uncaught error:', event.error);
            // Note: We don't automatically open the dialog for global errors
            // but we log it so users can manually report via Ctrl+Shift+B
        };

        // Catch unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            logger.error('[useErrorReporting] Unhandled promise rejection:', event.reason);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [reportBug]);
};
