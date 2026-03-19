import { logger } from '@/utils/logger';

/**
 * AcousticFingerprintService
 * Uses Chromaprint's fpcalc to generate a robust acoustic fingerprint.
 * This is the "Soul" of the song—it survives format changes and compression.
 * 
 * NOTE: This service uses Node.js 'child_process' and must only be executed
 * in the Electron Main process or via a Node-enabled environment.
 */
export interface AcousticFingerprint {
    fingerprint: string;
    duration: number;
}

export class AcousticFingerprintService {
    /**
     * Generates an acoustic fingerprint for an audio file.
     * @param filePath Path to the audio file on disk
     */
    async generateAcousticFingerprint(filePath: string): Promise<AcousticFingerprint | null> {
        // Prevent browser-side execution crashes
        if (typeof window !== 'undefined' && !((window as any).process?.type)) {
            logger.error('[AcousticFingerprint] Cannot run fpcalc in a pure browser environment.');
            return null;
        }

        try {
            // Dynamically import Node.js modules to prevent Vite/Rollup from bundling them for the browser
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execPromise = promisify(exec);

            const { stdout } = await execPromise(`fpcalc -json "${filePath}"`);
            const data = JSON.parse(stdout);

            if (!data.fingerprint) {
                throw new Error('fpcalc returned empty fingerprint');
            }

            return {
                fingerprint: data.fingerprint,
                duration: data.duration
            };
        } catch (error) {
            logger.error('[AcousticFingerprint] Failed to generate fingerprint:', error);
            return null;
        }
    }

    /**
     * Compare two Chromaprint fingerprints using Hamming distance.
     *
     * Chromaprint fingerprints are base64-encoded arrays of 32-bit hashes.
     * Similarity is computed by:
     *   1. Decoding both fingerprints from base64 to Uint32Array
     *   2. XOR-ing corresponding hash pairs
     *   3. Counting differing bits (popcount)
     *   4. Normalizing to a 0–100 similarity score
     *
     * A result ≥ 80 indicates a likely match (same recording, different format/compression).
     * A result ≥ 60 indicates a possible match (remix, cover, or re-master).
     * A result < 40 indicates the tracks are likely different compositions.
     *
     * @param fp1 Base64-encoded Chromaprint fingerprint
     * @param fp2 Base64-encoded Chromaprint fingerprint
     * @returns Similarity score from 0 (completely different) to 100 (identical)
     */
    compareFingerprints(fp1: string, fp2: string): number {
        // Fast path: identical strings
        if (fp1 === fp2) return 100;
        if (!fp1 || !fp2) return 0;

        try {
            const hashes1 = this.decodeFingerprint(fp1);
            const hashes2 = this.decodeFingerprint(fp2);

            if (hashes1.length === 0 || hashes2.length === 0) return 0;

            // Compare using the shorter fingerprint's length
            // (fingerprints may differ in length due to duration differences)
            const compareLength = Math.min(hashes1.length, hashes2.length);

            let totalBits = 0;
            let differingBits = 0;

            for (let i = 0; i < compareLength; i++) {
                const xor = (hashes1[i]! ^ hashes2[i]!) >>> 0; // XOR + unsigned conversion
                differingBits += this.popcount32(xor);
                totalBits += 32;
            }

            // Penalize length difference: treat missing hashes as 50% different
            const lengthDiff = Math.abs(hashes1.length - hashes2.length);
            differingBits += lengthDiff * 16; // 16 = half of 32 bits per hash
            totalBits += lengthDiff * 32;

            if (totalBits === 0) return 0;

            // Similarity = percentage of matching bits
            const similarity = ((totalBits - differingBits) / totalBits) * 100;
            return Math.max(0, Math.min(100, Math.round(similarity * 100) / 100));
        } catch (error) {
            logger.error('[AcousticFingerprint] Failed to compare fingerprints:', error);
            return 0;
        }
    }

    /**
     * Decode a base64-encoded Chromaprint fingerprint into an array of 32-bit hashes.
     * Chromaprint encodes fingerprints as base64 strings over a sequence of little-endian uint32 values.
     */
    private decodeFingerprint(base64: string): Uint32Array {
        // Decode base64 to binary string
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        // Convert bytes to 32-bit unsigned integers (little-endian)
        const hashCount = Math.floor(bytes.length / 4);
        const hashes = new Uint32Array(hashCount);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < hashCount; i++) {
            hashes[i] = view.getUint32(i * 4, true); // little-endian
        }

        return hashes;
    }

    /**
     * Count the number of set bits (1s) in a 32-bit integer.
     * Uses the Kernighan bit-counting algorithm for efficiency.
     */
    private popcount32(n: number): number {
        let count = 0;
        let val = n >>> 0; // Ensure unsigned
        while (val) {
            val &= val - 1; // Clear lowest set bit
            count++;
        }
        return count;
    }
}

export const acousticFingerprintService = new AcousticFingerprintService();
