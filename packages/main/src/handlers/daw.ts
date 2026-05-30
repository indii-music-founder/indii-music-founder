import { ipcMain } from 'electron';
import { dawServer, DAWState } from '../daw-server';
import log from 'electron-log';
import { BrowserWindow } from 'electron';

export const registerDawHandlers = () => {
    ipcMain.handle('daw:start', () => {
        dawServer.start();
        return true;
    });

    ipcMain.handle('daw:stop', () => {
        dawServer.stop();
        return true;
    });

    ipcMain.handle('daw:get-state', () => {
        return dawServer.getState();
    });

    // Notify renderer on state change
    dawServer.on('state-changed', (state: DAWState) => {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send('daw:state-changed', state);
            }
        });
    });
};
