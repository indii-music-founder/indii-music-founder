import { useCallback } from 'react';
import { useStore } from '@/core/store';
import type { BugReportType } from '@/modules/debug/BugReportDialog';
import { clearRecentUncaughtError, getRecentUncaughtError } from '@/modules/debug/useErrorReporting';

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
    // ISSUE-CI-REGRESSION: a raw object-literal selector (no useShallow, and
    // no reason to wrap a single field in an object) forced this hook —
    // called at the App root via useBugReportShortcut — to re-render on
    // EVERY Zustand store change, app-wide. Select the primitive directly.
    const setBugReportDialog = useStore((state) => state.setBugReportDialog);

    const open = useCallback((type: BugReportType, prefilledError?: string, prefilledModule?: string) => {
        setBugReportDialog({
            isOpen: true,
            type,
            prefilledError,
            prefilledModule,
        });
    }, [setBugReportDialog]);

    const reportBug = useCallback((errorMessage?: string, module?: string) => {
        // With no explicit error, pre-fill the most recent uncaught error (if any)
        // so the user does not have to retype what just went wrong.
        const recent = errorMessage ? null : getRecentUncaughtError();
        if (recent) clearRecentUncaughtError();
        open('bug', errorMessage ?? recent?.message, module ?? (recent?.module || undefined));
    }, [open]);

    const requestFeature = useCallback((title?: string) => {
        open('feature', title);
    }, [open]);

    return { reportBug, requestFeature, open };
};
