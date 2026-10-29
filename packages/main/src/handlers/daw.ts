import { validateSender } from '../utils/ipc-security';
import { ipcMain } from 'electron';
import { dawServer, DAWState } from '../daw-server';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import log from 'electron-log';
import { BrowserWindow } from 'electron';

export const registerDawHandlers = () => {
    ipcMain.handle('daw:start', async (event) => {
        validateSender(event);
        await dawServer.start();
        return true;
    });

    ipcMain.handle('daw:stop', async (event) => {
        validateSender(event);
        await dawServer.stop();
        return true;
    });

    ipcMain.handle('daw:get-connection-info', event => {
        validateSender(event);
        return dawServer.getConnectionInfo();
    });

    ipcMain.handle('daw:get-state', (event) => {
        validateSender(event);
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
