import { app, ipcMain, BrowserWindow } from 'electron';
import { validateSender } from '../utils/ipc-security';

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
}
