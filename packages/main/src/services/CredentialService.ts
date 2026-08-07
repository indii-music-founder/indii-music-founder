import { safeStorage } from 'electron';
import keytar from 'keytar';
type DistributorId = string;

const SERVICE_NAME = 'indii_Distribution';

export interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

/**
 * Thrown when a credential entry EXISTS in the keychain but cannot be read back —
 * OS keychain access changed, the machine was migrated, or the payload is corrupt.
 *
 * ISSUE-1286: this case used to return `null`, which every caller reasonably
 * interpreted as "nothing configured" and reported as "missing credentials". The
 * user was told to set up credentials they had in fact already saved, with no hint
 * that the real problem was decryption. These are different failures and now have
 * different types.
 */
export class CredentialDecryptionError extends Error {
    readonly distributorId: string;

    constructor(distributorId: string, cause?: unknown) {
        super(
            `Stored credentials for "${distributorId}" exist but could not be decrypted. ` +
            `They may have been saved on a different machine or by a different OS user. ` +
            `Re-enter and save them to repair.`
        );
        this.name = 'CredentialDecryptionError';
        this.distributorId = distributorId;
        if (cause !== undefined) this.cause = cause;
    }
}

export class CredentialService {

    /**
     * Save credentials for a specific distributor.
     * Uses Electron's safeStorage for platform-level encryption before storing in the keychain.
     */
    async saveCredentials(distributorId: DistributorId, credentials: Credentials): Promise<void> {
        const secretSerialized = JSON.stringify(credentials);

        // Phase 2 Security Enhancement: Encrypt the payload before keychain storage
        let payloadToStore: string;
        if (safeStorage.isEncryptionAvailable()) {
            const encryptedBuffer = safeStorage.encryptString(secretSerialized);
            payloadToStore = encryptedBuffer.toString('base64');
        } else {
            throw new Error('Encryption is not available. Credentials cannot be stored securely.');
        }

        await keytar.setPassword(SERVICE_NAME, distributorId, payloadToStore);
    }

    /**
     * Retrieve credentials for a specific distributor.
     * Automatically decrypts if the payload was encrypted with safeStorage.
     */
    async getCredentials(distributorId: DistributorId): Promise<Credentials | null> {
        try {
            const storedPayload = await keytar.getPassword(SERVICE_NAME, distributorId);
            if (!storedPayload) return null;

            let decryptedPayload: string;

            // Check if it's likely a base64 encrypted string or the old JSON
            if (storedPayload.trim().startsWith('{')) {
                // Legacy plain JSON
                decryptedPayload = storedPayload;
            } else {
                try {
                    if (safeStorage.isEncryptionAvailable()) {
                        const encryptedBuffer = Buffer.from(storedPayload, 'base64');
                        decryptedPayload = safeStorage.decryptString(encryptedBuffer);
                    } else {
                        throw new Error('safeStorage not available for decryption');
                    }
                } catch (_e) {
                    // ISSUE-1286: a stored-but-unreadable entry is NOT the same as no
                    // entry, so it must not collapse to `null` here. (The previous
                    // `startsWith('{')` retry on this line was also unreachable — this
                    // branch only runs when the payload does not start with '{'.)
                    console.error('[CredentialService] SafeStorage decryption failed:', _e);
                    throw new CredentialDecryptionError(distributorId, _e);
                }
            }

            return JSON.parse(decryptedPayload) as Credentials;
        } catch (_error) {
            // Preserve the distinction established above rather than flattening every
            // failure into "not configured".
            if (_error instanceof CredentialDecryptionError) throw _error;
            console.error('[CredentialService] getCredentials failed:', _error);
            return null;
        }
    }

    /**
     * Delete credentials for a specific distributor
     */
    async deleteCredentials(distributorId: DistributorId): Promise<boolean> {
        try {
            return await keytar.deletePassword(SERVICE_NAME, distributorId);
        } catch (_error) {
            console.error('[CredentialService] deleteCredentials failed:', _error);
            return false;
        }
    }

    /**
     * List which distributor IDs currently have stored credentials.
     * Existence only — never returns the stored secret value. Backs the
     * Security Center "API Credentials" pane (ISSUE-1305).
     */
    async listConfigured(): Promise<string[]> {
        try {
            const entries = await keytar.findCredentials(SERVICE_NAME);
            return entries.map((entry) => entry.account);
        } catch (_error) {
            console.error('[CredentialService] listConfigured failed:', _error);
            return [];
        }
    }
}

export const credentialService = new CredentialService();
