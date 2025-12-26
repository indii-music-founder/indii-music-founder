import { DistributorId } from '../distribution/types/distributor.ts';

export interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

/**
 * Frontend CredentialService
 * Delegates actual storage to the Electron Main process via IPC.
 */
export class CredentialService {

    /**
     * Save credentials for a specific distributor
     */
    async saveCredentials(distributorId: DistributorId, credentials: Credentials): Promise<void> {
        // @ts-ignore
        await window.electronAPI.credentials.save(distributorId, credentials);
    }

    /**
     * Retrieve credentials for a specific distributor
     */
    async getCredentials(distributorId: DistributorId): Promise<Credentials | null> {
        // @ts-ignore
        return await window.electronAPI.credentials.get(distributorId);
    }

    /**
     * Delete credentials for a specific distributor
     */
    async deleteCredentials(distributorId: DistributorId): Promise<boolean> {
        // @ts-ignore
        return await window.electronAPI.credentials.delete(distributorId);
    }
}

export const credentialService = new CredentialService();
