import { ipcMain, app } from 'electron';
import { sftpService } from '../services/SFTPService';
import { SFTPConfigSchema, SftpUploadSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';
import { z } from 'zod';
import path from 'path';
import os from 'os';
import fs from 'fs';

export const registerSFTPHandlers = () => {
    ipcMain.handle('sftp:connect', async (event, config: any) => {
        try {
            validateSender(event);
            const validatedConfig = SFTPConfigSchema.parse(config);
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
