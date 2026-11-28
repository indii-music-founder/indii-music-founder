import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { isDoNotSellEnabled, updateConsentPreferences } from '@/services/privacy/consent';

/**
 * Account-level privacy choices. The "Do Not Sell or Share" opt-out is stored
 * on the user's profile (so it follows the account) and mirrored into local
 * consent (so this device enforces it immediately).
 */
export const PrivacyPreferencesService = {
    /** Reads the account's opt-out and applies it on this device. */
    async loadDoNotSell(uid: string): Promise<boolean> {
        const snap = await getDoc(doc(db, 'users', uid));
        const accountValue = snap.exists() && snap.data()?.privacyPreferences?.doNotSell === true;
        // An opt-out made on either the account or this device wins.
        const effective = accountValue || isDoNotSellEnabled();
        if (effective !== isDoNotSellEnabled()) updateConsentPreferences({ doNotSell: effective });
        return effective;
    },

    /** Saves the opt-out to the account, then enforces it on this device. */
    async saveDoNotSell(uid: string, doNotSell: boolean): Promise<void> {
        await updateDoc(doc(db, 'users', uid), {
            'privacyPreferences.doNotSell': doNotSell,
            'privacyPreferences.updatedAt': new Date().toISOString(),
        });
        updateConsentPreferences({ doNotSell });
    },
};
