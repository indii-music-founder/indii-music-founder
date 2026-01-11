import { ipcMain, app } from 'electron';
import { sftpService } from '../services/SFTPService';
import { SFTPConfigSchema, SftpUploadSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';
import path from 'path';
import os from 'os';

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

            // SECURITY: Path Containment Check
            // Prevent exfiltration of arbitrary system files.
            // Allowed paths: Temporary Directory (for staged releases) or User Data (logs/app data).
            const allowedRoots = [
                os.tmpdir(),
                app.getPath('userData')
            ].map(p => path.resolve(p)); // Normalize

            const resolvedLocalPath = path.resolve(validated.localPath);

            const isAllowed = allowedRoots.some(root => {
                // Ensure exact match or proper subdirectory match (prevent /tmp vs /tmp_hacker prefix attacks)
                const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
                return resolvedLocalPath === root || resolvedLocalPath.startsWith(rootWithSep);
            });

            if (!isAllowed) {
                console.error(`[Security] Blocked SFTP upload from unauthorized path: ${resolvedLocalPath}`);
                throw new Error("Security: Access Denied. Cannot upload from this directory.");
            }

            const files = await sftpService.uploadDirectory(validated.localPath, validated.remotePath);
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
