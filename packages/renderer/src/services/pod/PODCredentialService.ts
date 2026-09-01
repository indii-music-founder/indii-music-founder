/**
 * PODCredentialService
 *
 * Manages lifecycle of Print-On-Demand provider API credentials.
 * Desktop (Electron): Stores credentials via keytar in the OS credential vault.
 * Web: Not supported — throws on any credential operation.
 *
 * Product model: Bring-Your-Own-Company (BYOK) — artists supply their own
 * API keys for their POD provider accounts. Keys never touch Firestore.
 */

import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { logger } from '@/utils/logger';
import type { PODProvider } from './PrintOnDemandService';

interface Credentials {
    [key: string]: string | undefined;
}

export class PODCredentialService {
    private static SERVICE_ID = (provider: PODProvider) => `indii-pod-${provider}`;

    /**
     * Save (or overwrite) an API key for a provider.
     * On Electron: stored via keytar with safeStorage envelope encryption.
     * Throws if Electron API is unavailable.
     */
    static async saveCredential(userId: string, provider: PODProvider, apiKey: string): Promise<void> {
        if (!window.electronAPI?.credentials) {
            throw new Error('Credential storage requires Electron desktop environment');
        }
        const serviceId = this.SERVICE_ID(provider);
        const creds: Credentials = { [userId]: apiKey };
        await window.electronAPI.credentials.save(serviceId, creds);
    }

    /**
     * Load the stored API key for a provider.
     * Returns null if no credential is stored or Electron unavailable.
     */
    static async loadCredential(userId: string, provider: PODProvider): Promise<string | null> {
        if (!window.electronAPI?.credentials) {
            logger.warn('Credential vault unavailable: Electron API required');
            return null;
        }
        try {
            const serviceId = this.SERVICE_ID(provider);
            const creds = await window.electronAPI.credentials.get(serviceId) as Credentials | null;
            return creds?.[userId] ?? null;
        } catch (error) {
            logger.error(`Failed to load credential for ${provider}:`, error);
            return null;
        }
    }

    /**
     * Load all stored credentials for a user across all POD providers.
     */
    static async loadAllCredentials(userId: string): Promise<Partial<Record<PODProvider, string>>> {
        if (!window.electronAPI?.credentials) {
            return {};
        }
        const providers: PODProvider[] = ['printful', 'printify', 'gooten'];
        const result: Partial<Record<PODProvider, string>> = {};
        for (const provider of providers) {
            try {
                const cred = await this.loadCredential(userId, provider);
                if (cred) result[provider] = cred;
            } catch {
                // Continue loading other providers if one fails
            }
        }
        return result;
    }

    /**
     * Remove a stored credential.
     */
    static async removeCredential(userId: string, provider: PODProvider): Promise<void> {
        if (!window.electronAPI?.credentials) {
            throw new Error('Credential storage requires Electron desktop environment');
        }
        const serviceId = this.SERVICE_ID(provider);
        await window.electronAPI.credentials.delete(serviceId);
    }

    /**
     * Validate an API key by making a lightweight real API call.
     * Returns true if the key is valid, false otherwise.
     * Note: This check runs AFTER retrieving from vault, never on plaintext storage.
     */
    static async validateKey(provider: PODProvider, apiKey: string): Promise<boolean> {
        try {
            switch (provider) {
                case 'printful': {
                    const res = await fetchWithTimeout('https://api.printful.com/store', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    }, 10_000);
                    return res.ok;
                }
                case 'printify': {
                    const res = await fetchWithTimeout('https://api.printify.com/v1/shops.json', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    }, 10_000);
                    return res.ok;
                }
                case 'gooten': {
                    const res = await fetchWithTimeout(
                        `https://prod.gooten.com/api/v5/orders?limit=1&billingKey=${apiKey}`,
                        undefined,
                        10_000
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
