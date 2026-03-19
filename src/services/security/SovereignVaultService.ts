/**
 * Sovereign Vault Service — Client-Side AES-GCM 256-bit Encryption
 *
 * Provides zero-knowledge encryption for sensitive career data
 * (legal strategies, financial plans, private notes) before writing
 * to Firestore. The encryption key never leaves the user's device.
 *
 * This ensures that even if the Firestore database is compromised,
 * the encrypted data is unreadable without the user's passphrase.
 *
 * Uses Web Crypto API (SubtleCrypto) for standards-compliant,
 * hardware-accelerated encryption.
 */

/** Encrypted payload structure stored in Firestore */
export interface EncryptedPayload {
    /** Base64-encoded initialization vector (12 bytes) */
    iv: string;

    /** Base64-encoded salt used for key derivation (16 bytes) */
    salt: string;

    /** Base64-encoded encrypted data (AES-GCM ciphertext + auth tag) */
    data: string;

    /** Version identifier for future algorithm migrations */
    version: 1;

    /** ISO 8601 timestamp of encryption */
    encryptedAt: string;
}

export class SovereignVaultService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KEY_LENGTH = 256;
    private static readonly IV_LENGTH = 12; // bytes (96 bits, NIST recommended for GCM)
    private static readonly SALT_LENGTH = 16; // bytes (128 bits)
    private static readonly PBKDF2_ITERATIONS = 600_000; // OWASP 2024 recommendation

    /**
     * Guard: Ensure we're in a browser environment with Web Crypto.
     * Prevents accidental server-side usage.
     */
    private static assertBrowserEnvironment(): void {
        if (typeof window === 'undefined' || !window.crypto?.subtle) {
            throw new Error(
                'SovereignVaultService requires a browser environment with Web Crypto API. ' +
                'Do not use this service in Node.js/server-side contexts.'
            );
        }
    }

    /**
     * Derive a CryptoKey from a user's passphrase using PBKDF2.
     *
     * @param passphrase - The user's master passphrase
     * @param salt - Random salt (generated or from existing EncryptedPayload)
     */
    static async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
        SovereignVaultService.assertBrowserEnvironment();

        const encoder = new TextEncoder();
        const rawKey = encoder.encode(passphrase);
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            rawKey.buffer as ArrayBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt.buffer as ArrayBuffer,
                iterations: SovereignVaultService.PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            keyMaterial,
            {
                name: SovereignVaultService.ALGORITHM,
                length: SovereignVaultService.KEY_LENGTH,
            },
            false, // Non-extractable — the key stays in Web Crypto
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt plaintext data using AES-GCM 256.
     *
     * @param plaintext - The data to encrypt (will be JSON.stringify'd if object)
     * @param passphrase - The user's master passphrase
     * @returns EncryptedPayload ready for Firestore storage
     */
    static async encrypt(plaintext: string | object, passphrase: string): Promise<EncryptedPayload> {
        SovereignVaultService.assertBrowserEnvironment();

        const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
        const encoder = new TextEncoder();

        // Generate random IV and salt
        const iv = crypto.getRandomValues(new Uint8Array(SovereignVaultService.IV_LENGTH));
        const salt = crypto.getRandomValues(new Uint8Array(SovereignVaultService.SALT_LENGTH));

        // Derive key
        const key = await SovereignVaultService.deriveKey(passphrase, salt);

        // Encrypt
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: SovereignVaultService.ALGORITHM,
                iv: iv.buffer as ArrayBuffer,
            },
            key,
            encoder.encode(text).buffer as ArrayBuffer
        );

        return {
            iv: SovereignVaultService.toBase64(iv),
            salt: SovereignVaultService.toBase64(salt),
            data: SovereignVaultService.toBase64(new Uint8Array(ciphertext)),
            version: 1,
            encryptedAt: new Date().toISOString(),
        };
    }

    /**
     * Decrypt an EncryptedPayload back to plaintext.
     *
     * @param payload - The encrypted payload from Firestore
     * @param passphrase - The user's master passphrase
     * @returns Decrypted plaintext string
     * @throws DOMException if the passphrase is wrong (auth tag fails)
     */
    static async decrypt(payload: EncryptedPayload, passphrase: string): Promise<string> {
        SovereignVaultService.assertBrowserEnvironment();

        const iv = SovereignVaultService.fromBase64(payload.iv);
        const salt = SovereignVaultService.fromBase64(payload.salt);
        const ciphertext = SovereignVaultService.fromBase64(payload.data);

        // Derive the same key from the stored salt
        const key = await SovereignVaultService.deriveKey(passphrase, salt);

        // Decrypt
        const plainBuffer = await crypto.subtle.decrypt(
            {
                name: SovereignVaultService.ALGORITHM,
                iv: iv.buffer as ArrayBuffer,
            },
            key,
            ciphertext.buffer as ArrayBuffer
        );

        const decoder = new TextDecoder();
        return decoder.decode(plainBuffer);
    }

    /**
     * Convenience: Decrypt and parse as JSON.
     */
    static async decryptJSON<T = unknown>(payload: EncryptedPayload, passphrase: string): Promise<T> {
        const plaintext = await SovereignVaultService.decrypt(payload, passphrase);
        return JSON.parse(plaintext) as T;
    }

    // --- Encoding Utilities ---

    private static toBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
    }

    private static fromBase64(b64: string): Uint8Array {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}
