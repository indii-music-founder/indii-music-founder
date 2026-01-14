import { ipcMain } from 'electron';
import { CredentialSchema, CredentialIdSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';

interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

export function registerCredentialHandlers() {
    ipcMain.handle('credentials:save', async (event, id: string, creds: Credentials) => {
        try {
            validateSender(event);
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

    ipcMain.handle('credentials:get', async (event, id: string) => {
        try {
            validateSender(event);
            const validatedId = CredentialIdSchema.parse(id);

            const { credentialService } = await import('../services/CredentialService');
            return await credentialService.getCredentials(validatedId);
        } catch (error) {
            console.error('Credential Get Failed:', error);
            return null;
        }
    });

    ipcMain.handle('credentials:delete', async (event, id: string) => {
        try {
            validateSender(event);
            const validatedId = CredentialIdSchema.parse(id);

            const { credentialService } = await import('../services/CredentialService');
            await credentialService.deleteCredentials(validatedId);
            return { success: true };
        } catch (error) {
            console.error('Credential Delete Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });
}
