import { ipcMain } from 'electron';
import { SFTPConfigSchema } from '../utils/validation';
import { z } from 'zod';

export function registerSFTPHandlers() {
    ipcMain.handle('sftp:connect', async (_event, config: any) => {
        const { sftpService } = await import('../services/SFTPService');
        try {
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

    ipcMain.handle('sftp:upload-directory', async (_event, localPath: string, remotePath: string) => {
        const { sftpService } = await import('../services/SFTPService');
        try {
            // Basic path validation - just strict string check for now
             if (typeof localPath !== 'string' || typeof remotePath !== 'string') {
                 throw new Error("Invalid path arguments");
             }

            await sftpService.uploadDirectory(localPath, remotePath);
            return { success: true };
        } catch (error) {
            console.error('SFTP Upload Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('sftp:disconnect', async () => {
        const { sftpService } = await import('../services/SFTPService');
        try {
            await sftpService.disconnect();
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
import { sftpService, SFTPConfig } from '../services/SFTPService';
import { SftpUploadSchema, validateSender } from '../validation';

export const registerSFTPHandlers = () => {
    ipcMain.handle('sftp:connect', async (event, config: SFTPConfig) => {
        validateSender(event);
        await sftpService.connect(config);
        return { success: true };
    });

    ipcMain.handle('sftp:upload-directory', async (event, localPath: string, remotePath: string) => {
        validateSender(event);

        // Validate Paths
        const validated = SftpUploadSchema.parse({ localPath, remotePath });

        const files = await sftpService.uploadDirectory(validated.localPath, validated.remotePath);
        return { success: true, files };
    });

    ipcMain.handle('sftp:disconnect', async (event) => {
        validateSender(event);
        await sftpService.disconnect();
        return { success: true };
    });

    ipcMain.handle('sftp:is-connected', async () => {
        const { sftpService } = await import('../services/SFTPService');
        return sftpService.isConnected();
    });
}
