import { useEffect, useRef, useCallback } from 'react';

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

export function useFocusTrap(isActive: boolean = true) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        return Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    }, []);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        // Save the currently focused element to restore later
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Focus the first focusable element inside the trap
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
            // Delay to ensure DOM is ready after render
            requestAnimationFrame(() => {
                focusable[0].focus();
            });
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const elements = getFocusableElements();
            if (elements.length === 0) return;

            const firstElement = elements[0];
            const lastElement = elements[elements.length - 1];

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
        };

        // Handle Escape key to close (optional — caller handles this)
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // Restore focus to previously focused element
            if (previousFocusRef.current && previousFocusRef.current.focus) {
                previousFocusRef.current.focus();
            }
        };
    }, [isActive, getFocusableElements]);

    return containerRef;
}
