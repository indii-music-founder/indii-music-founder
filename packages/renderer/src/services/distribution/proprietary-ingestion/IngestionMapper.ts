import { AudioIntelligenceProfile } from '@/services/audio/types';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

/**
 * IngestionMapper
 * 
 * Bridges the gap between "CLIP" (Audio Intelligence) and Ingestion Supply Chain Standards.
 * Maps high-fidelity Autonomous semantic analysis into strictly identifiable Ingestion metadata fields.
 */
export class IngestionMapper {

    /**
     * Transforms an Autonomous Audio Profile into the Ingestion-compliant subset of Golden Metadata.
     * This prepares the metadata for the IngestionNotificationService.
     */
    static mapAudioProfileToMetadata(profile: AudioIntelligenceProfile): Partial<ExtendedGoldenMetadata> {
        if (!profile.semantic) {
            return {};
        }

        const { semantic, technical } = profile;
        if (!semantic.ddexGenre?.trim()) {
            throw new Error('DDEX genre is required for ingestion metadata mapping.');
        }

        // 1. Core Ingestion Classifications
        const metadata: Partial<ExtendedGoldenMetadata> = {
            // Genre Mapping
            genre: semantic.ddexGenre.trim(),
            subGenre: semantic.ddexSubGenre,

            // Language (ISO 639-2)
            language: semantic.language || 'zxx', // 'zxx' = No Linguistic Content (Instrumental)

            // Explicit Content (Parental Advisory)
            // Ingestion Logic: Explicit = true -> 'Explicit', false -> 'NotExplicit'
            explicit: semantic.isExplicit || false,

            // Moods & Keywords for MediaAssetData (Media Enrichment and Description)
            mood: semantic.mood,
            keywords: semantic.marketingHooks?.keywords,

            // Musical Features from technical analysis
            bpm: technical.bpm,
            key: technical.scale === 'minor' ? `${technical.key}m` : technical.key,
            energy: technical.energy,

            // Duration from technical analysis
            durationSeconds: technical.duration,
            durationFormatted: this.formatDuration(technical.duration),

            // Intelligence Disclosure (IngestionNotification 4.3 compliance calls)
            // Since this comes FROM our Intelligence analysis, we might infer things, 
            // but the Autonomous tool usage itself usually comes from the Project state, not the audio analysis.
            // However, if the analysis DETECTS Intelligence artifacts (future feature), we could flag it.
            // For now, we leave aiGeneratedContent to be merged from the Project Source.
        };

        // 2. Marketing Data — prefer the dedicated marketingComment field (Session 1 Sonic Cortex),
        // fall back to the one-liner from marketingHooks for backward compat with older profiles
        metadata.marketingComment = semantic.marketingComment || semantic.marketingHooks?.oneLiner;

        // 3. Autonomous Artifact Disclosure (IngestionNotification 4.3 / Goal 3 compliance)
        if (semantic.productionValue?.aiArtifacts) {
            metadata.aiGeneratedContent = {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: true
            };
        }

        return metadata;
    }

    /**
     * Formats seconds into MM:SS
     */
    private static formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
