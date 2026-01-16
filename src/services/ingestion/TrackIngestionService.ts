import { fingerprintService } from '@/services/audio/FingerprintService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';
import { DDEX_CONFIG } from '@/core/config/ddex';

export class TrackIngestionService {

    /**
     * Ingests an audio file into the library.
     * 1. Fingerprints (Idempotency)
     * 2. Checks DB (Skip if exists)
     * 3. Analyzes (Technical + Semantic)
     * 4. Maps to Golden Metadata
     * 5. Saves
     */
    async ingestTrack(file: File): Promise<ExtendedGoldenMetadata> {
        console.log(`[TrackIngestion] Starting ingestion for: ${file.name}`);

        // 1. Generate Fingerprint
        const fingerprint = await fingerprintService.generateFingerprint(file);
        if (!fingerprint) {
            throw new Error('Failed to fingerprint audio file.');
        }

        // 2. Check Library (Idempotency)
        const existing = await trackLibrary.getByFingerprint(fingerprint);
        if (existing) {
            console.log(`[TrackIngestion] Track already exists: ${fingerprint}`);
            return existing;
        }

        // 3. Technical Analysis (Essentia)
        // Note: AudioIntelligence actually runs this internally, but we can run it here
        // if we want to separate concerns. However, AudioIntelligence returns a profile
        // that contains 'technical'. Let's trust AudioIntelligence to orchestrate.
        console.log('[TrackIngestion] Requesting full Audio Intelligence analysis...');
        const profile = await audioIntelligence.analyze(file);

        // 4. Map to Golden Metadata
        const metadata = this.mapProfileToMetadata(file, profile, fingerprint);

        // 5. Save to Library
        console.log('[TrackIngestion] Saving new track metadata...');
        await trackLibrary.saveTrack(metadata);

        return metadata;
    }

    private mapProfileToMetadata(
        file: File,
        profile: import('@/services/audio/types').AudioIntelligenceProfile,
        fingerprint: string
    ): ExtendedGoldenMetadata {
        const { technical, semantic } = profile;

        // Base metadata
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            masterFingerprint: fingerprint,

            // Inferred Basic Info
            trackTitle: file.name.replace(/\.[^/.]+$/, ""), // Strip extension
            durationSeconds: technical.duration,
            durationFormatted: this.formatDuration(technical.duration),

            // DDEX Fields from AI
            genre: semantic.ddexGenre || 'Unknown', // Fallback
            subGenre: semantic.ddexSubGenre,
            language: semantic.language || 'eng', // Default to English if undefined
            explicit: semantic.isExplicit,

            // Moods/Keywords
            mood: semantic.mood,
            keywords: semantic.marketingHooks.keywords,

            // Marketing
            marketingComment: semantic.marketingHooks.oneLiner,

            // Defaults for a "New Ingestion"
            releaseDate: new Date().toISOString().split('T')[0],
            releaseType: 'Single',
            territories: ['Worldwide'],
            distributionChannels: ['streaming', 'download'],
            labelName: DDEX_CONFIG.PARTY_NAME,
            dpid: DDEX_CONFIG.PARTY_ID,

            // AI Content Disclosure
            aiGeneratedContent: {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: false
            },

            // Status
            isGolden: false // Needs human review
        };

        return metadata;
    }

    private formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

export const trackIngestion = new TrackIngestionService();
