import { audioAnalysisService, AudioFeatures } from './AudioAnalysisService';
import { acousticFingerprintService } from './AcousticFingerprintService';

export class FingerprintService {

    /**
     * Generates a "Composite Fingerprint" for an audio file.
     * Layer 1: SHA-256 Hash of the binary data (Exact Match)
     * Layer 2: Musical Feature Hash (BPM_Key_Duration) for content identification
     * Layer 3: Acoustic Fingerprint (The "Soul") via Chromaprint
     * 
     * @param file The audio file to fingerprint
     * @param filePath The local path to the file (needed for fpcalc)
     * @param existingFeatures Optional pre-calculated features to optimize performance
     */
    async generateFingerprint(file: File, filePath?: string, existingFeatures?: AudioFeatures): Promise<string | null> {
        try {
            // 1. Generate Data Hash (SHA-256)
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const dataHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 2. Extract Musical Features
            let featureTag = 'UNKNOWN';
            try {
                let features = existingFeatures;

                if (!features) {
                    const analysisResult = await audioAnalysisService.analyze(file);
                    features = analysisResult.features;
                }

                const duration = features?.duration || await this.getDuration(file);
                if (features) {
                    featureTag = `${features.bpm}BPM_${features.key}${features.scale}_${Math.round(duration)}s`;
                }

            } catch (_err: unknown) {
                // Feature extraction failed
            }

            // 3. Extract Acoustic Fingerprint (The Soul)
            let soulHash = 'NO_SOUL';
            if (filePath) {
                const acoustic = await acousticFingerprintService.generateAcousticFingerprint(filePath);
                if (acoustic) {
                    // Take first 16 chars of the long chromaprint for the composite tag
                    soulHash = acoustic.fingerprint.substring(0, 16);
                }
            }

            // Composite ID: SONIC-DataHash-Features-SoulHash
            const shortHash = dataHash.substring(0, 16);

            return `SONIC-${shortHash}-${featureTag.replace(/\s+/g, '')}-${soulHash}`;

        } catch (_error: unknown) {
            return null;
        }
    }

    private async getDuration(file: File): Promise<number> {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            audio.src = URL.createObjectURL(file);
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };
            audio.onerror = () => resolve(0);
        });
    }
}

export const fingerprintService = new FingerprintService();
