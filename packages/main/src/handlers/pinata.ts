import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';

export function registerPinataHandlers() {
    ipcMain.handle('web3:pinata-upload', async (event, data) => {
        validateSender(event);
        return { success: false, error: 'Pinata upload is currently unsupported.' };
    });
}
