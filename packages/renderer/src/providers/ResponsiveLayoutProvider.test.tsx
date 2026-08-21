import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ResponsiveLayoutProvider, useResponsiveLayout } from './ResponsiveLayoutProvider';

/**
 * Regression: dragging a window edge fires native resize events far faster
 * than frames. The provider used to run setState per event, re-rendering the
 * ENTIRE provider subtree (every useResponsiveLayout consumer) per event.
 * The handler must coalesce to at most one state write per animation frame.
 */
describe('ResponsiveLayoutProvider resize coalescing', () => {
    // Object property (not a reassignment) so the react-hooks purity rule
    // accepts the deliberate render-count instrumentation.
    const renderCount = { value: 0 };

    const Consumer = () => {
        useResponsiveLayout();
        // eslint-disable-next-line react-hooks/immutability -- deliberate render-count instrumentation in a test
        renderCount.value += 1;
        return null;
    };

    beforeEach(() => {
        renderCount.value = 0;
        vi.useFakeTimers();
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('does not re-render consumers until the next animation frame, and then only once', () => {
        render(
            <ResponsiveLayoutProvider>
                <Consumer />
            </ResponsiveLayoutProvider>
        );
        const afterMount = renderCount.value;

        // Ten resize events land synchronously (a window drag)…
        act(() => {
            Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
            for (let i = 0; i < 10; i += 1) {
                window.dispatchEvent(new Event('resize'));
            }
        });

        // …but NOTHING renders until the coalesced frame fires.
        expect(renderCount.value).toBe(afterMount);

        act(() => {
            vi.advanceTimersByTime(17);
        });

        // Exactly one re-render for the ten events.
        expect(renderCount.value).toBe(afterMount + 1);
    });

    it('keeps delivering subsequent resize batches after the frame fires', () => {
        render(
            <ResponsiveLayoutProvider>
                <Consumer />
            </ResponsiveLayoutProvider>
        );
        const afterMount = renderCount.value;

        act(() => {
            Object.defineProperty(window, 'innerWidth', { value: 640, configurable: true });
            window.dispatchEvent(new Event('resize'));
            vi.advanceTimersByTime(17);
        });
        expect(renderCount.value).toBe(afterMount + 1);

        act(() => {
            Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
            window.dispatchEvent(new Event('resize'));
            vi.advanceTimersByTime(17);
        });
        expect(renderCount.value).toBe(afterMount + 2);
    });
});
