import { ipcMain, app } from 'electron';
import { sftpService } from '../services/SFTPService';
import { SFTPConfigSchema, SftpUploadSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { validateSafeHostAsync } from '../utils/network-security';
import { accessControlService } from '../security/AccessControlService';
import { z } from 'zod';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { credentialService } from '../services/CredentialService';

export const registerSFTPHandlers = () => {
    ipcMain.handle('sftp:connect', async (event, config: unknown) => {
        try {
            validateSender(event);
            const validatedConfig = SFTPConfigSchema.parse(config);

            // Security: Validate host to prevent SSRF
            await validateSafeHostAsync(validatedConfig.host);

            await sftpService.connect(validatedConfig);
            return { success: true };
        } catch (error) {
            console.error('SFTP Connect Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('sftp:connect-distributor', async (event, distributorId: string) => {
        try {
            validateSender(event);
            if (!distributorId) throw new Error('distributorId is required');

            // 1. Fetch credentials securely from the main process keychain
            const credentials = await credentialService.getCredentials(distributorId as any);
            if (!credentials || !credentials.sftpHost || (!credentials.sftpPassword && !credentials.password)) {
                throw new Error(`Missing or incomplete SFTP credentials for ${distributorId}`);
            }

            // 2. Validate host to prevent SSRF
            await validateSafeHostAsync(credentials.sftpHost);

            // 3. Connect securely
            await sftpService.connect({
                host: credentials.sftpHost,
                port: credentials.sftpPort ? parseInt(credentials.sftpPort) : 22,
                username: credentials.sftpUsername || credentials.username || '',
                password: credentials.sftpPassword || credentials.password || ''
            });

            return { success: true };
        } catch (error) {
            console.error(`[SFTP] Secure Connect Failed for ${distributorId}:`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('sftp:upload-directory', async (event, localPath: string, remotePath: string) => {
        try {
            validateSender(event);

            // Input Schema Validation
            const validated = SftpUploadSchema.parse({ localPath, remotePath });

            // Resolve symbolic links to their real path to prevent TOCTOU attacks
            let realLocalPath: string;
            try {
                // If it doesn't exist, realpathSync throws, which acts as a check.
                realLocalPath = fs.realpathSync(validated.localPath);
            } catch (e) {
                // If we can't resolve it, fail secure.
                throw new Error(`Security: Invalid path or permission denied: ${validated.localPath}`);
            }

            // SECURITY: Path Authorization Check using AccessControlService
            if (!accessControlService.verifyAccess(realLocalPath)) {
                console.error(`[Security] Blocked SFTP upload from unauthorized path: ${realLocalPath}`);
                throw new Error("Security: Access Denied. Cannot upload from this directory.");
            }

            // Note: We pass the ORIGINAL localPath to sftpService if we want to preserve the structure as the user sees it,
            // OR we pass the resolved path.
            // Passing the resolved path is safer as it eliminates race conditions (TOCTOU) where the link changes between check and use.
            const files = await sftpService.uploadDirectory(realLocalPath, validated.remotePath);
            return { success: true, files };
        } catch (error) {
            console.error('SFTP Upload Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('sftp:disconnect', async (event) => {
        try {
            validateSender(event);
            await sftpService.disconnect();
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('sftp:is-connected', async (event) => {
        // Simple status check, but good to validate sender anyway
        try {
            validateSender(event);
            return sftpService.isConnected();
        } catch (error) {
            return false;
        }
    });
}
