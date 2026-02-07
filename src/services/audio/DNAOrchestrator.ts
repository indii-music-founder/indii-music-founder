import { fingerprintService } from '@/services/audio/FingerprintService';
import { sonicCortexService, SonicDescription } from '@/services/audio/SonicCortexService';
import { logger } from '@/utils/logger';

export interface SonicDNA {
    sonicId: string;
    description: SonicDescription | null;
    tags: string[];
}

/**
 * DNAOrchestrator
 * High-level service to coordinate all audio "Soul" extraction steps.
 * This is the "Engine" that powers the AudioAnalyzer UI.
 */
export class DNAOrchestrator {
    /**
     * Complete Sonic DNA Extraction pipeline.
     */
    async extractDNA(file: File, filePath?: string): Promise<SonicDNA | null> {
        try {
            logger.info(`[DNAOrchestrator] Starting DNA extraction for: ${file.name}`);

            // 1. Generate Triple-Lock Fingerprint (Body + Vibe + Soul)
            const sonicId = await fingerprintService.generateFingerprint(file, filePath);
            if (!sonicId) throw new Error('Fingerprinting failed');

            logger.info(`[DNAOrchestrator] SONIC-ID Generated: ${sonicId}`);

            // 2. Deep Sonic Reasoning (The Brain)
            // Convert to Base64 for the multimodal API
            const base64 = await this.fileToBase64(file);
            const description = await sonicCortexService.describeSoul(base64, file.type);

            // 3. Derive Tags from Reasoning
            const derivedTags = description ? [
                ...description.suggestedKeywords,
                description.mood,
                description.timbre
            ] : [];

            return {
                sonicId,
                description,
                tags: Array.from(new Set(derivedTags)).filter(t => !!t)
            };

        } catch (error) {
            logger.error('[DNAOrchestrator] Pipeline failure:', error);
            return null;
        }
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const dnaOrchestrator = new DNAOrchestrator();
