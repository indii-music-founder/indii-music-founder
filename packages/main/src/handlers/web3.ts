import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';

export function registerWeb3Handlers() {
    ipcMain.handle('web3:execute-transaction', async (event, _data) => {
        validateSender(event);
        return { success: false, error: 'Web3 transactions are currently unsupported.' };
    });
}
