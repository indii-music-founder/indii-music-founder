import { useEffect } from 'react';
import { useBugReport } from './useBugReport';

/**
 * Keyboard shortcut hook for bug reporting
 * Ctrl+Shift+B = Report Bug
 * Ctrl+Shift+F = Request Feature
 */
export const useBugReportShortcut = () => {
    const { reportBug, requestFeature } = useBugReport();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Shift+B = Report Bug
            if (e.ctrlKey && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                reportBug();
            }

            // Ctrl+Shift+F = Request Feature
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                requestFeature();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [reportBug, requestFeature]);
};
