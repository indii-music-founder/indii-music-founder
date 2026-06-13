import keytar from 'keytar';
import { safeStorage } from 'electron';

const SERVICE_NAME = 'indii_Auth';
const TOKEN_ACCOUNT = 'indii_RefreshToken';

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
            void 0;
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
        } catch (_error) {
            void 0;
            return null;
        }
    }

    async deleteToken(): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, TOKEN_ACCOUNT);
        } catch (_error) {
            void 0;
            return false;
        }
    }
}

export const authStorage = new AuthStorage();
