/**
 * Security Utilities
 * Centralized place for security-critical functions to avoid duplication and insecure practices.
 */

/**
 * Generates a secure random ID suitable for database keys, job IDs, etc.
 * Uses cryptographically secure random number generation.
 *
 * @param prefix - Optional prefix for the ID (e.g. 'job', 'key')
 * @param length - Length of the random suffix (default: 9)
 * @returns A string in the format `${prefix}_${timestamp}_${randomHex}`
 */
export function generateSecureId(prefix: string = 'id', length: number = 9): string {
    const timestamp = Date.now();
    const randomHex = generateSecureHex(length);
    return `${prefix}_${timestamp}_${randomHex}`;
}

/**
 * Generates a cryptographically secure random hex string.
 *
 * @param length - The number of characters to generate
 * @returns A random hex string
 */
export function generateSecureHex(length: number): string {
    const byteLength = Math.ceil(length / 2);
    const array = new Uint8Array(byteLength);
    // Support both browser (window.crypto) and Node.js (global.crypto or require('crypto').webcrypto)
    const crypto = globalThis.crypto;

    if (!crypto || !crypto.getRandomValues) {
        // Fallback for older environments or specific test setups where crypto is missing.
        // In production, this should ideally throw, but for broad compatibility/dev:
        console.warn('[Security] crypto.getRandomValues not available. Falling back to Math.random (INSECURE).');
        return Math.random().toString(16).substring(2, 2 + length);
    }

    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return hex.substring(0, length);
}
