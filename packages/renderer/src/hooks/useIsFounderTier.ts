import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

/**
 * True when the signed-in user holds a founder/paid seat. The founder treats
 * "founder" and "paid" as the same state, so any of the tier fields carrying
 * 'founder' (or the explicit isFounder flag) qualifies. Free/anonymous users
 * resolve to false and keep seeing the standard onboarding surfaces.
 */
export function useIsFounderTier(): boolean {
    return useStore(useShallow(s => {
        const p = s.userProfile as {
            tier?: string;
            subscriptionTier?: string;
            plan?: string;
            isFounder?: boolean;
        } | null;
        return p?.tier === 'founder'
            || p?.subscriptionTier === 'founder'
            || p?.plan === 'founder'
            || p?.isFounder === true;
    }));
}
