import log from 'electron-log';
import { ipcMain } from 'electron';
import { CredentialSchema, CredentialIdSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';
import { credentialService, CredentialDecryptionError } from '../services/CredentialService';

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

            await credentialService.saveCredentials(id, creds);
            return { success: true };
        } catch (error) {
            log.error('Credential Save Failed:', error);
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

            return await credentialService.getCredentials(validatedId);
        } catch (error) {
            log.error('Credential Get Failed:', error);
            // ISSUE-1286: "saved but undecryptable" must reach the user as its own
            // failure. Returning null here would put back exactly the ambiguity the
            // typed error exists to remove — the renderer would show "not configured"
            // for credentials the user has already saved.
            if (error instanceof CredentialDecryptionError) throw error;
            return null;
        }
    });

    ipcMain.handle('credentials:delete', async (event, id: string) => {
        try {
            validateSender(event);
            const validatedId = CredentialIdSchema.parse(id);

            await credentialService.deleteCredentials(validatedId);
            return { success: true };
        } catch (error) {
            log.error('Credential Delete Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    // ISSUE-1305: existence-only enumeration for the Security Center "API
    // Credentials" pane. Never returns secret values — only which distributor
    // IDs currently have something stored.
    ipcMain.handle('credentials:list', async (event) => {
        try {
            validateSender(event);
            return await credentialService.listConfigured();
        } catch (error) {
            log.error('Credential List Failed:', error);
            return [];
        }
    });
}
