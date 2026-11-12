import { useLayoutEffect, useRef, useCallback, useId } from 'react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';

/**
 * Item 271: Focus Trap Hook for Modal Dialogs
 *
 * Traps keyboard focus inside a container element so that
 * Tab/Shift+Tab cycles only through focusable children.
 * Prevents focus from escaping into the background DOM.
 *
 * Usage:
 *   function MyModal({ isOpen, onClose }: Props) {
 *     const trapRef = useFocusTrap(isOpen);
 *
 *     return (
 *       <dialog ref={trapRef} open={isOpen}>
 *         <button onClick={onClose}>Close</button>
 *         <input placeholder="Name" />
 *       </dialog>
 *     );
 *   }
 */

const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(', ');

function focusableElementsIn(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(element => {
        // Editable regions are focusable without an explicit tabindex even
        // though their tabIndex property defaults to -1.
        const implicitEditor = element.matches('[contenteditable="true"]') && !element.hasAttribute('tabindex');
        if ((element.tabIndex < 0 && !implicitEditor) || element.matches(':disabled') || element.closest('[hidden], [inert]')) return false;
        const view = element.ownerDocument.defaultView;
        for (let current: HTMLElement | null = element; current; current = current.parentElement) {
            const style = view?.getComputedStyle(current);
            if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
        }
        return true;
    });
}

const activeTrapContainers: HTMLElement[] = [];

export function isTopFocusTrap(container: HTMLElement | null): boolean {
    return container !== null && activeTrapContainers.at(-1) === container;
}

export function useFocusTrap(isActive: boolean = true) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Capture the trigger during render. React's autoFocus runs before layout
    // effects, so waiting until the effect can mistake an input inside the new
    // dialog for the element that should receive focus when it closes.
    const previousFocusRef = useRef<HTMLElement | null>(
        typeof document !== 'undefined' ? document.activeElement as HTMLElement : null,
    );
    const trapId = useId();

    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        return focusableElementsIn(containerRef.current);
    }, []);

    useGlobalShortcut({
        id: `focus-trap-tab-${trapId}`,
        key: 'Tab',
        ignoreInput: true, // Needs to run even when focus is in an input
        priority: 'modal',
        handler: (e) => {
            // Stacked dialogs register separate Tab handlers. Only the top
            // trap may redirect focus, even when it does not need to wrap.
            if (activeTrapContainers.at(-1) !== containerRef.current) return;
            const elements = getFocusableElements();
            if (elements.length === 0) {
                e.preventDefault();
                if (containerRef.current && !containerRef.current.hasAttribute('tabindex')) containerRef.current.tabIndex = -1;
                containerRef.current?.focus();
                return;
            }

            const firstElement = elements[0]!;
            const lastElement = elements[elements.length - 1]!;

            // Focus can remain on the container while loading, or on a
            // control removed from the tab order. Neither is a tab boundary.
            if (!elements.includes(document.activeElement as HTMLElement)) {
                e.preventDefault();
                (e.shiftKey ? lastElement : firstElement).focus();
                return;
            }

            if (e.shiftKey) {
                // Shift+Tab: If focus is on first element, wrap to last
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: If focus is on last element, wrap to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    }, [trapId, getFocusableElements], isActive);

    useLayoutEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        activeTrapContainers.push(container);

        const activeElement = document.activeElement as HTMLElement | null;
        const alreadyFocusedInside = !!activeElement && containerRef.current.contains(activeElement);

        // When no descendant used autoFocus, the current element is the real
        // trigger and should be restored on close.
        if (!alreadyFocusedInside) {
            previousFocusRef.current = activeElement;
        }

        // Focus the first focusable element inside the trap
        const focusable = getFocusableElements();
        const originalTabIndex = container.getAttribute('tabindex');
        if (focusable.length === 0 && originalTabIndex === null) container.tabIndex = -1;
        if (!alreadyFocusedInside && focusable.length > 0) {
            focusable[0]!.focus();
        } else if (!alreadyFocusedInside) {
            container.focus();
        }

        return () => {
            const wasTopTrap = isTopFocusTrap(container);
            const index = activeTrapContainers.lastIndexOf(container);
            if (index !== -1) activeTrapContainers.splice(index, 1);
            if (originalTabIndex === null && container.tabIndex === -1) container.removeAttribute('tabindex');
            if (!wasTopTrap) return;
            const nextTrap = activeTrapContainers.at(-1);
            if (nextTrap?.isConnected) {
                const previousFocus = previousFocusRef.current;
                const remainingControls = focusableElementsIn(nextTrap);
                const target = previousFocus?.isConnected && remainingControls.includes(previousFocus)
                    ? previousFocus
                    : remainingControls[0] ?? nextTrap;
                if (target === nextTrap && !nextTrap.hasAttribute('tabindex')) nextTrap.tabIndex = -1;
                target.focus();
            } else if (previousFocusRef.current?.isConnected) {
                previousFocusRef.current.focus();
            }
        };
    }, [isActive, getFocusableElements]);

    return containerRef;
}
