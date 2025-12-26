
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
     * Save credentials for a specific distributor
     */
    async saveCredentials(distributorId: DistributorId, credentials: Credentials): Promise<void> {
        try {
            const secretSerialized = JSON.stringify(credentials);
            await keytar.setPassword(SERVICE_NAME, distributorId, secretSerialized);
            console.log(`[CredentialService] Saved credentials for ${distributorId}`);
        } catch (error) {
            console.error(`[CredentialService] Failed to save credentials for ${distributorId}`, error);
            throw error;
        }
    }

    /**
     * Retrieve credentials for a specific distributor
     */
    async getCredentials(distributorId: DistributorId): Promise<Credentials | null> {
        try {
            const secretSerialized = await keytar.getPassword(SERVICE_NAME, distributorId);
            if (!secretSerialized) {
                return null;
            }
            return JSON.parse(secretSerialized) as Credentials;
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
