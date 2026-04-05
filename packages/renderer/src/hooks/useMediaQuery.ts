import { useSyncExternalStore, useCallback } from 'react';

/**
 * SSR-safe media query hook using useSyncExternalStore
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (callback: () => void) => {
            const mediaQuery = window.matchMedia(query);
            mediaQuery.addEventListener('change', callback);
            return () => mediaQuery.removeEventListener('change', callback);
        },
        [query]
    );

    const getSnapshot = () => {
        return window.matchMedia(query).matches;
    };

    const getServerSnapshot = () => {
        return false;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
