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
     * Compare two fingerprints (Placeholder for future fuzzy-matching logic)
     */
    compareFingerprints(fp1: string, fp2: string): number {
        return fp1 === fp2 ? 100 : 0;
    }
}

export const acousticFingerprintService = new AcousticFingerprintService();
