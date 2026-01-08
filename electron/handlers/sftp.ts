import { ipcMain } from 'electron';
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

    ipcMain.handle('sftp:is-connected', () => {
        return sftpService.isConnected();
    });
};
