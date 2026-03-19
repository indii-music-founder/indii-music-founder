/**
 * Cryptographically-secure random number utilities.
 *
 * Uses `crypto.getRandomValues()` instead of `Math.random()` for all
 * security-sensitive operations (IDs, tokens, nonces, ISRC/UPC generation).
 *
 * `Math.random()` is NOT cryptographically secure and MUST NOT be used for:
 * - Session tokens / nonces
 * - ISRC / UPC / identifier generation
 * - Any value an attacker could predict or exploit
 *
 * For UI-only randomness (jitter animations, particle effects, random colors),
 * `Math.random()` remains acceptable.
 */

/**
 * Generate a cryptographically-secure random integer in [min, max).
 *
 * @example
 * const roll = secureRandomInt(1, 7); // 1-6 inclusive
 */
export function secureRandomInt(min: number, max: number): number {
    if (min >= max) throw new RangeError(`min (${min}) must be less than max (${max})`);

    const range = max - min;
    if (range <= 0 || !Number.isFinite(range)) {
        throw new RangeError(`Invalid range: [${min}, ${max})`);
    }

    // Use rejection sampling to avoid modulo bias
    const maxUint32 = 0xFFFFFFFF;
    const limit = maxUint32 - (maxUint32 % range);
    const array = new Uint32Array(1);

    let value!: number;
    do {
        crypto.getRandomValues(array);
        value = array[0]!;
    } while (value > limit);

    return min + (value % range);
}

/**
 * Generate a cryptographically-secure random hex string.
 *
 * @param length - Number of random bytes (output will be 2x this length in hex chars)
 * @returns Hex string (e.g., "a3f4b9c1e2d0...")
 *
 * @example
 * const sessionId = secureRandomHex(16); // 32-character hex string
 */
export function secureRandomHex(length = 16): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a cryptographically-secure random alphanumeric string.
 * Uses a URL-safe base-62 alphabet (A-Z, a-z, 0-9).
 *
 * @param length - Desired output string length
 * @returns Alphanumeric string
 *
 * @example
 * const token = secureRandomAlphanumeric(24); // "xK9mP2qR7nL4jB8wC1vT6yA"
 */
export function secureRandomAlphanumeric(length = 16): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const result: string[] = [];
    for (let i = 0; i < length; i++) {
        result.push(alphabet[secureRandomInt(0, alphabet.length)]!);
    }
    return result.join('');
}

/**
 * Generate a UUID v4 using the Web Crypto API.
 * Falls back to `crypto.randomUUID()` when available.
 *
 * @returns RFC 4122 compliant UUID v4 string
 *
 * @example
 * const id = secureUUIDv4(); // "550e8400-e29b-41d4-a716-446655440000"
 */
export function secureUUIDv4(): string {
    // Modern browsers and Node 19+ support crypto.randomUUID()
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Manual fallback for older environments
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant RFC 4122

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Securely shuffle an array using the Fisher-Yates algorithm
 * with cryptographic randomness.
 *
 * Returns a new array (does not mutate the input).
 */
export function secureShuffleArray<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = secureRandomInt(0, i + 1);
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
}

/**
 * Pick a random element from an array using cryptographic randomness.
 */
export function secureRandomPick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new RangeError('Cannot pick from an empty array');
    return array[secureRandomInt(0, array.length)]!;
}
