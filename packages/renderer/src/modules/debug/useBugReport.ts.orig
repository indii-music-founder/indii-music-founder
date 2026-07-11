import { useCallback } from 'react';
import { useStore } from '@/core/store';
import type { BugReportType } from './BugReportDialog';

/**
 * Hook to open the bug report dialog from any component
 *
 * Usage:
 * ```tsx
 * const { reportBug, requestFeature } = useBugReport();
 *
 * // Report a bug
 * reportBug("Image generation failed", "image/ImageGenerationService.ts");
 *
 * // Request a feature
 * requestFeature("Dark mode toggle");
 * ```
 */
export const useBugReport = () => {
    const { setBugReportDialog } = useStore((state) => ({
        setBugReportDialog: state.setBugReportDialog,
    }));

    const open = useCallback((type: BugReportType, prefilledError?: string, prefilledModule?: string) => {
        setBugReportDialog({
            isOpen: true,
            type,
            prefilledError,
            prefilledModule,
        });
    }, [setBugReportDialog]);

    const reportBug = useCallback((errorMessage?: string, module?: string) => {
        open('bug', errorMessage, module);
    }, [open]);

    const requestFeature = useCallback((title?: string) => {
        open('feature', title);
    }, [open]);

    return { reportBug, requestFeature, open };
};
