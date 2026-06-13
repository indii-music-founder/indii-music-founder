import { safeStorage } from 'electron';
import keytar from 'keytar';
type DistributorId = string;

const SERVICE_NAME = 'indii_Distribution';

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
                void 0;
                throw new Error('Encryption is not available. Credentials cannot be stored securely.');
            }

            await keytar.setPassword(SERVICE_NAME, distributorId, payloadToStore);
            void 0;
        } catch (error) {
            void 0;
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
                } catch (_e) {
                    void 0;
                    // If it's not JSON and decryption failed, we can't use it
                    if (storedPayload.trim().startsWith('{')) return JSON.parse(storedPayload);
                    return null;
                }
            }

            return JSON.parse(decryptedPayload) as Credentials;
        } catch (_error) {
            void 0;
            return null;
        }
    }

    /**
     * Delete credentials for a specific distributor
     */
    async deleteCredentials(distributorId: DistributorId): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, distributorId);
        } catch (_error) {
            void 0;
            return false;
        }
    }
}

export const credentialService = new CredentialService();
