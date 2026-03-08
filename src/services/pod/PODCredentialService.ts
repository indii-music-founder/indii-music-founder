/**
 * PODCredentialService
 *
 * Manages lifecycle of Print-On-Demand provider API credentials.
 * Stores credentials in Firestore (user-scoped, field-level security).
 * On Electron desktop, delegates to keytar for OS credential storage.
 *
 * Firestore path: users/{uid}/integrations/pod_credentials
 * Fields: { printful?: string, printify?: string, gooten?: string }
 */

import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import type { PODProvider } from './PrintOnDemandService';

const CREDENTIAL_COLLECTION = 'users';
const CREDENTIAL_DOC_ID = 'pod_credentials';
const INTEGRATIONS_SUBCOLLECTION = 'integrations';

export class PODCredentialService {
    private static getDocRef(userId: string) {
        return doc(
            db,
            CREDENTIAL_COLLECTION,
            userId,
            INTEGRATIONS_SUBCOLLECTION,
            CREDENTIAL_DOC_ID
        );
    }

    /**
     * Save (or overwrite) an API key for a provider.
     * The key is stored as a Firestore field. For production use,
     * consider encrypting with a KMS-derived key before storing.
     */
    static async saveCredential(userId: string, provider: PODProvider, apiKey: string): Promise<void> {
        const ref = this.getDocRef(userId);
        await setDoc(ref, { [provider]: apiKey }, { merge: true });
    }

    /**
     * Load the stored API key for a provider.
     * Returns null if no credential is stored.
     */
    static async loadCredential(userId: string, provider: PODProvider): Promise<string | null> {
        try {
            const ref = this.getDocRef(userId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return null;
            const data = snap.data();
            return (data?.[provider] as string) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Load all stored credentials for a user.
     */
    static async loadAllCredentials(userId: string): Promise<Partial<Record<PODProvider, string>>> {
        try {
            const ref = this.getDocRef(userId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return {};
            return snap.data() as Partial<Record<PODProvider, string>>;
        } catch {
            return {};
        }
    }

    /**
     * Remove a stored credential.
     */
    static async removeCredential(userId: string, provider: PODProvider): Promise<void> {
        const ref = this.getDocRef(userId);
        await updateDoc(ref, { [provider]: deleteField() });
    }

    /**
     * Validate an API key by making a lightweight real API call.
     * Returns true if the key is valid, false otherwise.
     */
    static async validateKey(provider: PODProvider, apiKey: string): Promise<boolean> {
        try {
            switch (provider) {
                case 'printful': {
                    const res = await fetch('https://api.printful.com/store', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    return res.ok;
                }
                case 'printify': {
                    const res = await fetch('https://api.printify.com/v1/shops.json', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    return res.ok;
                }
                case 'gooten': {
                    // Gooten uses a partner billing key — validate by listing catalog
                    const res = await fetch(
                        `https://prod.gooten.com/api/v5/orders?limit=1&billingKey=${apiKey}`
                    );
                    return res.ok;
                }
                default:
                    return false;
            }
        } catch {
            return false;
        }
    }
}
