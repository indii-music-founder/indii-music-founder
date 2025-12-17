import { app, ipcMain } from 'electron';

export function registerSystemHandlers() {
    ipcMain.handle('get-platform', () => process.platform);
    ipcMain.handle('get-app-version', () => app.getVersion());

    ipcMain.handle('privacy:toggle-protection', (event, isEnabled) => {
        const win = (require('electron').BrowserWindow).fromWebContents(event.sender);
        if (win) win.setContentProtection(isEnabled);
    });
}
