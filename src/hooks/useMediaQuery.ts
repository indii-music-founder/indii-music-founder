import { useState, useEffect, useCallback } from 'react';

/**
 * SSR-safe media query hook
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        // SSR-safe: return false on server
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    const handleChange = useCallback((event: MediaQueryListEvent) => {
        setMatches(event.matches);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(query);

        // Set initial value
        setMatches(mediaQuery.matches);

        // Modern API (addEventListener) with fallback
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            // Legacy Safari
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        }
    }, [query, handleChange]);

    return matches;
}
