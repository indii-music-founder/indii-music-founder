import { db } from "@/services/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AppException, AppErrorCode } from '@/shared/types/errors';

export interface LinkedAccount {
    platform: string;
    accountId: string;
    username: string;
    displayName: string;
    profileImageUrl?: string;
    linkedAt: number;
}

export interface OAuthResult {
    success: boolean;
    provider: string;
    accessToken?: string;
    userId?: string;
    error?: string;
    account?: LinkedAccount;
}

export class SocialOAuthService {
    /**
     * Connect a social platform via OAuth
     */
    static async initiateOAuth(provider: string): Promise<LinkedAccount | null> {
        if (!window.electronAPI) {
            throw new AppException(
                AppErrorCode.ENVIRONMENT_ERROR,
                'Social OAuth requires Electron environment'
            );
        }

        try {
            // We invoke a main process handler that opens a BrowserWindow for OAuth
            const result = await window.electronAPI.social.connectOAuth(provider);

            if (result?.success) {
                const account: LinkedAccount = {
                    platform: provider,
                    accountId: result.userId || 'unknown',
                    username: result.username || 'user',
                    displayName: result.displayName || 'User',
                    linkedAt: Date.now()
                };

                // Persist the association in Firestore (non-sensitive info)
                await this.saveAccountAssociation(account);

                // Save tokens securely in the main process via credentials API
                await window.electronAPI.credentials.save(`social_${provider}`, {
                    accessToken: result.accessToken,
                    userId: result.userId
                });

                return account;
            }

            return null;
        } catch (error) {
            console.error(`[SocialOAuthService] ${provider} connection failed:`, error);
            throw error; // Re-throw so the UI can handle the specific error
        }
    }

    /**
     * Save the linked account reference in Firestore
     */
    private static async saveAccountAssociation(account: LinkedAccount): Promise<void> {
        const { useStore } = await import("@/core/store");
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return;

        const accountRef = doc(db, "users", userProfile.id, "linked_accounts", account.platform);
        await setDoc(accountRef, {
            ...account,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    /**
     * Check if a provider is connected
     */
    static async isConnected(provider: string): Promise<boolean> {
        if (!window.electronAPI) return false;
        const creds = await window.electronAPI.credentials.get(`social_${provider}`);
        return !!creds?.accessToken;
    }

    /**
     * Disconnect a provider
     */
    static async disconnect(provider: string): Promise<void> {
        if (!window.electronAPI) return;
        await window.electronAPI.credentials.delete(`social_${provider}`);

        // Also remove from Firestore
        const { useStore } = await import("@/core/store");
        const userProfile = useStore.getState().userProfile;
        if (userProfile?.id) {
            const accountRef = doc(db, "users", userProfile.id, "linked_accounts", provider);
            await setDoc(accountRef, { linkedAt: null, updatedAt: serverTimestamp() }, { merge: true });
        }
    }

    /**
     * Get all linked accounts for the current user
     */
    static async getLinkedAccounts(): Promise<LinkedAccount[]> {
        const { useStore } = await import("@/core/store");
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const platforms = ['twitter', 'instagram', 'tiktok'];
        const accounts: LinkedAccount[] = [];

        for (const platform of platforms) {
            const docRef = doc(db, "users", userProfile.id, "linked_accounts", platform);
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().linkedAt) {
                accounts.push(snap.data() as LinkedAccount);
            }
        }

        return accounts;
    }
}
