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
            console.error('[AuthStorage] Failed to save token:', error);
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
                    console.error('[AuthStorage] SafeStorage decryption failed:', _e);
                    // Fallback if not encrypted or corrupted
                    return storedPayload;
                }
            }
            return storedPayload;
        } catch (_error) {
            console.error('[AuthStorage] Failed to get token:', _error);
            return null;
        }
    }

    async deleteToken(): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, TOKEN_ACCOUNT);
        } catch (_error) {
            return false;
        }
    }

    async getAuthenticatedUserId(): Promise<string | null> {
        const token = await this.getToken();
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length >= 2) {
                const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
                const parsed = JSON.parse(payloadJson) as { user_id?: string; sub?: string; uid?: string };
                return parsed.user_id || parsed.sub || parsed.uid || null;
            }
        } catch (_e) {
            // Non-JWT raw token format fallback
        }
        return token;
    }
}

export const authStorage = new AuthStorage();
