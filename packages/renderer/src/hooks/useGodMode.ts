import { useState, useEffect } from 'react';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * useGodMode — reactive hook that resolves the Firebase Auth `god_mode`
 * custom claim for the currently authenticated user.
 *
 * Returns `{ isGodMode, loading }`.
 * - `loading` is true while the claim is being resolved.
 * - `isGodMode` is true only when the user's ID token contains `god_mode: true`.
 *
 * Re-evaluates when the ID token changes (e.g. on refresh or sign-in).
 */
export function useGodMode(): { isGodMode: boolean; loading: boolean } {
  const [isGodMode, setIsGodMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkClaim = async () => {
      try {
        const user = auth.currentUser;
        if (!user || typeof user.getIdTokenResult !== 'function') {
          if (!cancelled) {
            setIsGodMode(false);
            setLoading(false);
          }
          return;
        }
        const tokenResult = await user.getIdTokenResult();
        if (!cancelled) {
          setIsGodMode(tokenResult?.claims?.god_mode === true);
          setLoading(false);
        }
      } catch (err) {
        logger.warn('[useGodMode] Failed to read god_mode claim', err);
        if (!cancelled) {
          setIsGodMode(false);
          setLoading(false);
        }
      }
    };

    checkClaim();

    // Re-check when auth state changes (e.g. token refresh)
    // Guard: auth.onIdTokenChanged may not exist in test environments
    const unsubscribe = typeof auth.onIdTokenChanged === 'function'
      ? auth.onIdTokenChanged(() => {
          if (!cancelled) setLoading(true);
          checkClaim();
        })
      : () => {};

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { isGodMode, loading };
}
