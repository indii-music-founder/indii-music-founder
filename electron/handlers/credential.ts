import { ipcMain } from 'electron';
import { credentialService } from '../services/CredentialService';
import { DistributorId } from '../../src/services/distribution/types/distributor';

interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

export const registerCredentialHandlers = () => {

    // Save Credentials
    ipcMain.handle('credentials:save', async (_event, id: string, creds: Credentials) => {
        try {
            await credentialService.saveCredentials(id as DistributorId, creds);
            return { success: true };
        } catch (error) {
            console.error(`[Main] Failed to save credentials for ${id}:`, error);
            throw error;
        }
    });

    // Get Credentials
    ipcMain.handle('credentials:get', async (_event, id: string) => {
        try {
            return await credentialService.getCredentials(id as DistributorId);
        } catch (error) {
            console.error(`[Main] Failed to get credentials for ${id}:`, error);
            throw error;
        }
    });

    // Delete Credentials
    ipcMain.handle('credentials:delete', async (_event, id: string) => {
        try {
            return await credentialService.deleteCredentials(id as DistributorId);
        } catch (error) {
            console.error(`[Main] Failed to delete credentials for ${id}:`, error);
            throw error;
        }
    });

    console.log('[Main] Credential handlers registered');
};
