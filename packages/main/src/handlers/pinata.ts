import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { pinataService } from '../services/web3/PinataService';

export function registerPinataHandlers() {
    ipcMain.handle('web3:pinata-upload', async (event, data: { file: number[]; filename: string }) => {
        validateSender(event);
        const { file, filename } = data || {};
        if (!Array.isArray(file) || !filename) {
            return { success: false, error: 'Invalid upload payload: expected { file: number[], filename: string }.' };
        }
        const buffer = Buffer.from(file);
        return pinataService.uploadFile(buffer, filename);
    });
}
