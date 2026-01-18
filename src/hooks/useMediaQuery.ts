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

            const listener = () => {
                callback();
            };

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', listener);
                return () => mediaQuery.removeEventListener('change', listener);
            } else {
                // Legacy Safari
                mediaQuery.addListener(listener);
                return () => mediaQuery.removeListener(listener);
            }
        },
        [query]
    );

    const getSnapshot = () => {
        return window.matchMedia(query).matches;
    };

        // Set initial value
        if (matches !== mediaQuery.matches) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMatches(mediaQuery.matches);
        }

        // Modern API (addEventListener) with fallback
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            // Legacy Safari
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        }
    }, [query, handleChange, matches]);
    const getSnapshot = () => {
        return window.matchMedia(query).matches;
    };

    const getServerSnapshot = () => {
        return false;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
