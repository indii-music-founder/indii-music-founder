import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Writes profile/brand-kit fields for the signed-in user. The screen is updated
 * optimistically before this runs, so a rejected write (rules, network) must be
 * reported to the user; a bare `updateDoc` would leave them looking at a value
 * that was never saved and raise an unhandled rejection.
 */
export async function persistUserUpdates(
    userId: string | undefined,
    updates: Record<string, unknown>,
    onFailure: (message: string) => void,
): Promise<boolean> {
    if (!userId) return false;
    try {
        await updateDoc(doc(db, 'users', userId), updates);
        return true;
    } catch (error) {
        logger.error('[BrandManager] Failed to save profile changes:', error);
        onFailure('Your change could not be saved. Please try again.');
        return false;
    }
}
