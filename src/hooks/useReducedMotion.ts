import { useState, useEffect } from 'react';

/**
 * Item 276: Prefers-Reduced-Motion Hook
 *
 * Detects the user's `prefers-reduced-motion` media query setting
 * and returns true when the user prefers reduced motion. Use this
 * to gate Framer Motion animations and CSS transitions.
 *
 * Usage:
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 *
 * return (
 *   <motion.div
 *     animate={{ opacity: 1, y: prefersReducedMotion ? 0 : 20 }}
 *     transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
 *   >
 *     ...
 *   </motion.div>
 * );
 * ```
 */
export function useReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handler = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return prefersReducedMotion;
}
