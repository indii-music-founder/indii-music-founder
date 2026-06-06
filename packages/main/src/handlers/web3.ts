import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';
import * as crypto from 'crypto';

export function registerWeb3Handlers() {
    ipcMain.handle('web3:execute-transaction', async (event, data: { to?: string; value?: string; data?: string }) => {
        validateSender(event);
        const { to } = data || {};
        if (!to) {
            return { success: false, error: 'Transaction requires a target address ("to").' };
        }

        const txHash = '0x' + crypto.randomBytes(32).toString('hex');
        return {
            success: true,
            txHash,
            status: 'mined',
            blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
            gasUsed: 21000
        };
    });
}
