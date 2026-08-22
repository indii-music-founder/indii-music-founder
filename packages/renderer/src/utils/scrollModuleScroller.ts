/**
 * Scrolls the app shell's module scroller (the overflow container that holds
 * whatever module is active) back to the very top.
 *
 * Used when a dashboard overlay collapses: the removal shifts the layout, and
 * the founder wants the indii logo and "My Dashboard" title visible again
 * rather than wherever mid-scroll the viewport happened to be.
 *
 * Returns true when a scroller was found and scrolled.
 */
export function scrollModuleScrollerToTop(): boolean {
    if (typeof document === 'undefined') return false;
    const scroller = document.querySelector<HTMLElement>('[data-module-scroller]');
    if (!scroller) return false;
    scroller.scrollTo({ top: 0, behavior: 'auto' });
    return true;
}

/**
 * Dismissal handlers call this: rAF fires after React commits the unmount,
 * so the scroll lands on the post-collapse layout instead of the pre-collapse
 * scroll height.
 */
export function scrollModuleScrollerToTopAfterPaint(): void {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            scrollModuleScrollerToTop();
        });
        return;
    }
    scrollModuleScrollerToTop();
}
