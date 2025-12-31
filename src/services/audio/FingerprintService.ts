import { audioAnalysisService, AudioFeatures } from './AudioAnalysisService';

export class FingerprintService {

    /**
     * Generates a "Composite Fingerprint" for an audio file.
     * Layer 1: SHA-256 Hash of the binary data (Exact Match)
     * Layer 2: Musical Feature Hash (BPM_Key_Duration) for content identification
     * 
     * @param file The audio file to fingerprint
     * @param existingFeatures Optional pre-calculated features to optimize performance
     */
    async generateFingerprint(file: File, existingFeatures?: AudioFeatures): Promise<string | null> {
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
                    features = await audioAnalysisService.analyze(file);
                }

                // Optimization: Use pre-calculated duration if available
                const duration = features?.duration || await this.getDuration(file);
                // Format: BPM_KEY_DURATION
                // We use Math.round for BPM/Duration to allow slight variations in "similar" files if we ever fuzzy match
                featureTag = `${features.bpm}BPM_${features.key}${features.scale}_${Math.round(duration)}s`;

            } catch (err) {
                console.warn('FingerprintService: Could not extract features for ID', err);
            }

            // Composite ID: hash-features
            // We take first 16 chars of hash for brevity (collision safe for local)
            const shortHash = dataHash.substring(0, 16);

            return `SONIC-${shortHash}-${featureTag.replace(/\s+/g, '')}`;

        } catch (error) {
            console.error('Fingerprint generation failed:', error);
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
