import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';

export function registerSystemHandlers() {
    ipcMain.handle('get-platform', (event) => {
        validateSender(event);
        return process.platform;
    });

    ipcMain.handle('get-app-version', (event) => {
        validateSender(event);
        return app.getVersion();
    });

    ipcMain.handle('privacy:toggle-protection', (event, isEnabled) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.setContentProtection(isEnabled);
    });

    ipcMain.handle('system:select-file', async (event, options?: { title?: string, filters?: { name: string, extensions: string[] }[] }) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        const result = await dialog.showOpenDialog(win, {
            title: options?.title || 'Select File',
            properties: ['openFile'],
            filters: options?.filters
        });

        if (result.canceled) return null;

        if (result.filePaths.length > 0) {
            accessControlService.grantAccess(result.filePaths[0]);
        }

        return result.filePaths[0];
    });

    ipcMain.handle('system:select-directory', async (event, options?: { title?: string }) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        const result = await dialog.showOpenDialog(win, {
            title: options?.title || 'Select Directory',
            properties: ['openDirectory']
        });

        if (result.canceled) return null;

        if (result.filePaths.length > 0) {
            accessControlService.grantAccess(result.filePaths[0]);
        }

        return result.filePaths[0];
    });
}

