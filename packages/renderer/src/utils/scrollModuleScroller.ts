/**
 * Scrolls the app shell's module scroller and any internal workspace scroller
 * back to the very top.
 *
 * Used when a dashboard overlay collapses or on module mount: the founder wants
 * the top greeting / header visible rather than wherever mid-scroll the viewport
 * happened to be.
 *
 * Returns true when at least one scroller was found and scrolled.
 */
export function scrollModuleScrollerToTop(): boolean {
    if (typeof document === 'undefined') return false;
    const scrollers = document.querySelectorAll<HTMLElement>('[data-module-scroller], [data-workspace-scroller]');
    if (scrollers.length === 0) return false;
    scrollers.forEach(scroller => {
        if (typeof scroller.scrollTo === 'function') {
            scroller.scrollTo({ top: 0, behavior: 'auto' });
        }
        scroller.scrollTop = 0;
    });
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
