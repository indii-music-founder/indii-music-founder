import keytar from 'keytar';
import { safeStorage } from 'electron';

const SERVICE_NAME = 'IndiiOS_Auth';
const TOKEN_ACCOUNT = 'IndiiOS_RefreshToken';

export class AuthStorage {
    async saveToken(token: string): Promise<void> {
        try {
            let payloadToStore = token;
            if (safeStorage.isEncryptionAvailable()) {
                const encryptedBuffer = safeStorage.encryptString(token);
                payloadToStore = encryptedBuffer.toString('base64');
            }
            await keytar.setPassword(SERVICE_NAME, TOKEN_ACCOUNT, payloadToStore);
        } catch (error) {
            console.error('[AuthStorage] Failed to save token', error);
            throw error;
        }
    }

    async getToken(): Promise<string | null> {
        try {
            const storedPayload = await keytar.getPassword(SERVICE_NAME, TOKEN_ACCOUNT);
            if (!storedPayload) return null;

            if (safeStorage.isEncryptionAvailable()) {
                try {
                    const encryptedBuffer = Buffer.from(storedPayload, 'base64');
                    return safeStorage.decryptString(encryptedBuffer);
                } catch (_e) {
                    // Fallback if not encrypted or corrupted
                    return storedPayload;
                }
            }
            return storedPayload;
        } catch (error) {
            console.error('[AuthStorage] Failed to get token', error);
            return null;
        }
    }

    async deleteToken(): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, TOKEN_ACCOUNT);
        } catch (error) {
            console.error('[AuthStorage] Failed to delete token', error);
            return false;
        }
    }
}

export const authStorage = new AuthStorage();
