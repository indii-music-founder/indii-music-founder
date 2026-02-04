import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export interface AcousticFingerprint {
    fingerprint: string;
    duration: number;
}

/**
 * AcousticFingerprintService
 * Uses Chromaprint's fpcalc to generate a robust acoustic fingerprint.
 * This is the "Soul" of the song—it survives format changes and compression.
 */
export class AcousticFingerprintService {
    /**
     * Generates an acoustic fingerprint for an audio file.
     * @param filePath Path to the audio file on disk
     */
    async generateAcousticFingerprint(filePath: string): Promise<AcousticFingerprint | null> {
        try {
            // Use fpcalc to generate the fingerprint
            // -json output for easy parsing
            const { stdout } = await execPromise(`fpcalc -json "${filePath}"`);
            const data = JSON.parse(stdout);

            return {
                fingerprint: data.fingerprint,
                duration: data.duration
            };
        } catch (error) {
            console.error('[AcousticFingerprint] Failed to generate fingerprint:', error);
            return null;
        }
    }

    /**
     * Compare two fingerprints (Placeholder for future fuzzy-matching logic)
     */
    compareFingerprints(fp1: string, fp2: string): number {
        // In a real scenario, this would use a bitwise comparison or the AcoustID API
        // For now, it's an exact match check
        return fp1 === fp2 ? 100 : 0;
    }
}

export const acousticFingerprintService = new AcousticFingerprintService();
