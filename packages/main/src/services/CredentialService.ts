import { safeStorage } from 'electron';
import keytar from 'keytar';
import { DistributorId } from '../../src/services/distribution/types/distributor';

const SERVICE_NAME = 'IndiiOS_Distribution';

export interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

export class CredentialService {

    /**
     * Save credentials for a specific distributor.
     * Uses Electron's safeStorage for platform-level encryption before storing in the keychain.
     */
    async saveCredentials(distributorId: DistributorId, credentials: Credentials): Promise<void> {
        try {
            const secretSerialized = JSON.stringify(credentials);
            
            // Phase 2 Security Enhancement: Encrypt the payload before keychain storage
            let payloadToStore: string;
            if (safeStorage.isEncryptionAvailable()) {
                const encryptedBuffer = safeStorage.encryptString(secretSerialized);
                payloadToStore = encryptedBuffer.toString('base64');
            } else {
                console.warn('[CredentialService] safeStorage not available, falling back to plain keychain storage');
                payloadToStore = secretSerialized;
            }

            await keytar.setPassword(SERVICE_NAME, distributorId, payloadToStore);
            console.info(`[CredentialService] Securely saved credentials for ${distributorId}`);
        } catch (error) {
            console.error(`[CredentialService] Failed to save credentials for ${distributorId}`, error);
            throw error;
        }
    }

    /**
     * Retrieve credentials for a specific distributor.
     * Automatically decrypts if the payload was encrypted with safeStorage.
     */
    async getCredentials(distributorId: DistributorId): Promise<Credentials | null> {
        try {
            const storedPayload = await keytar.getPassword(SERVICE_NAME, distributorId);
            if (!storedPayload) return null;

            let decryptedPayload: string;
            
            // Check if it's likely a base64 encrypted string or the old JSON
            if (storedPayload.trim().startsWith('{')) {
                // Legacy plain JSON
                decryptedPayload = storedPayload;
            } else {
                try {
                    if (safeStorage.isEncryptionAvailable()) {
                        const encryptedBuffer = Buffer.from(storedPayload, 'base64');
                        decryptedPayload = safeStorage.decryptString(encryptedBuffer);
                    } else {
                        throw new Error('safeStorage not available for decryption');
                    }
                } catch (e) {
                    console.error('[CredentialService] Decryption failed, may be legacy or corrupted data');
                    // If it's not JSON and decryption failed, we can't use it
                    if (storedPayload.trim().startsWith('{')) return JSON.parse(storedPayload);
                    return null;
                }
            }

            return JSON.parse(decryptedPayload) as Credentials;
        } catch (error) {
            console.error(`[CredentialService] Failed to get credentials for ${distributorId}`, error);
            return null;
        }
    }

    /**
     * Delete credentials for a specific distributor
     */
    async deleteCredentials(distributorId: DistributorId): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, distributorId);
        } catch (error) {
            console.error(`[CredentialService] Failed to delete credentials for ${distributorId}`, error);
            return false;
        }
    }
}

export const credentialService = new CredentialService();
