import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { setBugReportDialog } = vi.hoisted(() => ({ setBugReportDialog: vi.fn() }));

vi.mock('@/core/store', () => {
    const state = { currentModule: 'creative', setBugReportDialog };
    const useStore = (selector: (s: typeof state) => unknown) => selector(state);
    useStore.getState = () => state;
    return { useStore };
});

import {
    RECENT_ERROR_WINDOW_MS,
    clearRecentUncaughtError,
    getRecentUncaughtError,
    recordUncaughtError,
    useErrorReporting,
} from '@/modules/debug/useErrorReporting';
import { useBugReport } from '@/modules/debug/useBugReport';

describe('useErrorReporting', () => {
    afterEach(() => clearRecentUncaughtError());

    it('captures an unhandled rejection with the module it happened in', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderHook(() => useErrorReporting());

        const event = new Event('unhandledrejection') as PromiseRejectionEvent;
        Object.defineProperty(event, 'reason', { value: new Error('Upload failed: 413') });
        window.dispatchEvent(event);

        expect(getRecentUncaughtError()).toMatchObject({ message: 'Upload failed: 413', module: 'creative' });
        expect(error).toHaveBeenCalled();
    });

    it('forgets errors older than the reporting window', () => {
        recordUncaughtError(new Error('old'), 'fallback', 1_000);
        expect(getRecentUncaughtError(1_000 + RECENT_ERROR_WINDOW_MS + 1)).toBeNull();
    });

    it('pre-fills a bug report with the recent error once, then clears it', () => {
        recordUncaughtError(new Error('Render crashed'), 'fallback');
        const { result } = renderHook(() => useBugReport());

        result.current.reportBug();
        expect(setBugReportDialog).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'bug', prefilledError: 'Render crashed', prefilledModule: 'creative' }),
        );

        result.current.reportBug();
        expect(setBugReportDialog).toHaveBeenLastCalledWith(
            expect.objectContaining({ prefilledError: undefined, prefilledModule: undefined }),
        );
    });

    it('keeps an explicit error message over the captured one', () => {
        recordUncaughtError(new Error('captured'), 'fallback');
        const { result } = renderHook(() => useBugReport());

        result.current.reportBug('Image generation failed', 'creative');
        expect(setBugReportDialog).toHaveBeenLastCalledWith(
            expect.objectContaining({ prefilledError: 'Image generation failed' }),
        );
        expect(getRecentUncaughtError()).not.toBeNull();
    });
});
