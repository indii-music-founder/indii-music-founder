import { ipcMain } from 'electron';
import { sftpService, SFTPConfig } from '../services/SFTPService';

export const registerSFTPHandlers = () => {
    ipcMain.handle('sftp:connect', async (_event, config: SFTPConfig) => {
        await sftpService.connect(config);
        return { success: true };
    });

    ipcMain.handle('sftp:upload-directory', async (_event, localPath: string, remotePath: string) => {
        const files = await sftpService.uploadDirectory(localPath, remotePath);
        return { success: true, files };
    });

    ipcMain.handle('sftp:disconnect', async () => {
        await sftpService.disconnect();
        return { success: true };
    });

    ipcMain.handle('sftp:is-connected', () => {
        return sftpService.isConnected();
    });
};
