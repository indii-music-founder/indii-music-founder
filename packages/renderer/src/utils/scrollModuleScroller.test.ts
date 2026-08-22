import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrollModuleScrollerToTop } from './scrollModuleScroller';

describe('scrollModuleScrollerToTop', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('scrolls the marked module scroller to the very top', () => {
        const scroller = document.createElement('div');
        scroller.setAttribute('data-module-scroller', '');
        let scrollTop = 420;
        Object.defineProperty(scroller, 'scrollTop', {
            get: () => scrollTop,
            set: (v: number) => { scrollTop = v; },
        });
        // jsdom does not implement Element.scrollTo — provide the sink directly.
        (scroller as unknown as { scrollTo: (opts: { top: number }) => void }).scrollTo =
            (opts: { top: number }) => { scrollTop = opts.top; };
        document.body.appendChild(scroller);

        expect(scrollModuleScrollerToTop()).toBe(true);
        expect(scrollTop).toBe(0);
    });

    it('reports false cleanly when no module scroller exists', () => {
        expect(scrollModuleScrollerToTop()).toBe(false);
    });
});
