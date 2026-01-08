import { ipcMain } from 'electron';
import { CredentialSchema } from '../utils/validation';
import { z } from 'zod';

interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

export function registerCredentialHandlers() {
    ipcMain.handle('credentials:save', async (_event, id: string, creds: Credentials) => {
        try {
            // Validate
            CredentialSchema.parse({ id, creds });

            const { credentialService } = await import('../services/CredentialService');
            await credentialService.saveCredentials(id, creds);
            return { success: true };
        } catch (error) {
            console.error('Credential Save Failed:', error);
             if (error instanceof z.ZodError) {
                 return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('credentials:get', async (_event, id: string) => {
        try {
            if (typeof id !== 'string' || !id) throw new Error("Invalid ID");

            const { credentialService } = await import('../services/CredentialService');
            return await credentialService.getCredentials(id);
        } catch (error) {
            console.error('Credential Get Failed:', error);
            return null;
        }
    });

    ipcMain.handle('credentials:delete', async (_event, id: string) => {
        try {
            if (typeof id !== 'string' || !id) throw new Error("Invalid ID");

            const { credentialService } = await import('../services/CredentialService');
            await credentialService.deleteCredentials(id);
            return { success: true };
        } catch (error) {
            console.error('Credential Delete Failed:', error);
            return { success: false, error: String(error) };
        }
    });
}
