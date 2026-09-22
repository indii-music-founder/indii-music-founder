import { fingerprintService } from '@/services/audio/FingerprintService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { Logger } from '@/core/logger/Logger';
import { auth } from '@/services/firebase';
import { masterAudioService } from '@/services/audio/MasterAudioService';
import type { MasterAudioReference } from '@/services/metadata/types';
import { withPlannedSongIntakeQuestions, type ArtistContext, type DetectedAudioTagSchema } from '@indii/shared';
import type { z } from 'zod';

export class TrackIngestionService {

    /**
     * Ingests an audio file into the library.
     * 1. Fingerprints (Idempotency)
     * 2. Checks DB (Skip if exists)
     * 3. Analyzes (Technical + Semantic)
     * 4. Maps to Golden Metadata
     * 5. Saves
     */
    async ingestTrack(file: File, options?: { forceReanalyze?: boolean; artistContext?: ArtistContext }): Promise<ExtendedGoldenMetadata> {
        Logger.info('TrackIngestion', `Starting ingestion for: ${file.name}`);

        // 1. Generate Fingerprint
        const fingerprint = await fingerprintService.generateFingerprint(file);
        if (!fingerprint) {
            throw new Error('Failed to fingerprint audio file.');
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('User must be authenticated to ingest a master recording.');
        }

        const masterAsset = await masterAudioService.persist(file, {
            userId,
            masterFingerprint: fingerprint,
        });

        const observedAt = new Date().toISOString();
        const embeddedTags = await this.extractEmbeddedTags(file, observedAt);

        // 2. Check Library (Idempotency)
        if (!options?.forceReanalyze) {
            const existing = await trackLibrary.getByFingerprint(fingerprint);
            if (existing) {
                Logger.info('TrackIngestion', `Track already exists: ${fingerprint}`);
                const hydrated = {
                    ...existing,
                    userId,
                    masterAsset,
                    songIntake: withPlannedSongIntakeQuestions({
                        schemaVersion: 'song-intake.v1',
                        intakeId: `intake:${fingerprint}`,
                        ownerUid: userId,
                        recordingEntityId: existing.songIntake?.recordingEntityId ?? `recording:${fingerprint}`,
                        contentHash: masterAsset.contentHash,
                        fingerprint,
                        originalFileName: file.name,
                        recordingKind: existing.songIntake?.recordingKind ?? 'UNKNOWN',
                        technicalAnalysisComplete: true,
                        embeddedTags: { ...(existing.songIntake?.embeddedTags ?? {}), ...embeddedTags },
                        catalogMatches: [{
                            legacyTrackId: existing.id ?? fingerprint,
                            entityId: existing.songIntake?.recordingEntityId,
                            matchType: 'EXACT_FINGERPRINT', confidence: 1,
                            provenance: { state: 'DETECTED', sourceType: 'SYSTEM', sourceId: 'track-library', evidence: [], observedAt },
                        }],
                        possibleExistingRelease: existing.releaseDate ? 'YES' : 'UNKNOWN',
                        artistContext: options?.artistContext,
                        createdAt: existing.songIntake?.createdAt ?? observedAt,
                        updatedAt: observedAt,
                    }),
                };
                // Persist the refreshed intake evidence even when ownership and
                // the protected master reference were already current.
                await trackLibrary.saveTrack(hydrated);
                return hydrated;
            }
        } else {
            Logger.info('TrackIngestion', `Force reanalyze enabled. Bypassing cache for: ${fingerprint}`);
            try {
                const { useStore } = await import('@/core/store');
                useStore.getState().invalidateAudioProfile?.(fingerprint);
            } catch {
                // Non-blocking in headless/test environments without store
            }
        }

        // 3. Technical Analysis (Essentia)
        // Note: AudioIntelligence actually runs this internally, but we can run it here
        // if we want to separate concerns. However, AudioIntelligence returns a profile
        // that contains 'technical'. Let's trust AudioIntelligence to orchestrate.
        Logger.info('TrackIngestion', 'Waiting for protected canonical-master analysis receipt...');
        const profile = await audioIntelligence.analyzeCanonicalMaster(masterAsset, userId);

        // 4. Map to Golden Metadata
        const metadata = this.mapProfileToMetadata(file, profile, fingerprint, userId, masterAsset);
        metadata.songIntake = withPlannedSongIntakeQuestions({
            schemaVersion: 'song-intake.v1',
            intakeId: `intake:${fingerprint}`,
            ownerUid: userId,
            recordingEntityId: `recording:${fingerprint}`,
            contentHash: masterAsset.contentHash,
            fingerprint,
            originalFileName: file.name,
            recordingKind: 'UNKNOWN',
            technicalAnalysisComplete: true,
            embeddedTags,
            catalogMatches: [],
            possibleExistingRelease: 'UNKNOWN',
            artistContext: options?.artistContext,
            createdAt: observedAt,
            updatedAt: observedAt,
        });

        // 5. Save to Library
        Logger.info('TrackIngestion', 'Saving new track metadata...');
        await trackLibrary.saveTrack(metadata);

        return metadata;
    }

    private async extractEmbeddedTags(file: File, observedAt: string): Promise<Record<string, z.infer<typeof DetectedAudioTagSchema>>> {
        const filePath = (file as File & { path?: string }).path;
        if (!filePath || !window.electronAPI) return {};
        try {
            const result = await window.electronAPI.audio.analyze(filePath);
            if (result.status !== 'success') return {};
            const supported: Record<string, string> = {
                title: 'title', artist: 'artist', album: 'album', date: 'date',
                isrc: 'isrc', tsrc: 'isrc', iswc: 'iswc', upc: 'upc', barcode: 'upc',
                originaltitle: 'originaltitle',
            };
            const detected: Record<string, z.infer<typeof DetectedAudioTagSchema>> = {};
            for (const [rawKey, rawValue] of Object.entries(result.metadata.tags ?? {})) {
                const key = supported[rawKey.toLowerCase()];
                const value = typeof rawValue === 'string' ? rawValue.trim() : '';
                if (!key || !value) continue;
                detected[key] = {
                    key, value, requiresHumanConfirmation: true,
                    provenance: { state: 'DETECTED', sourceType: 'SYSTEM', sourceId: `embedded-tag:${rawKey}`, evidence: [], observedAt },
                };
            }
            return detected;
        } catch {
            return {};
        }
    }

    private mapProfileToMetadata(
        file: File,
        profile: import('@/services/audio/types').AudioIntelligenceProfile,
        fingerprint: string,
        userId: string,
        masterAsset: MasterAudioReference
    ): ExtendedGoldenMetadata {
        const { technical, semantic } = profile;

        // Base metadata
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            masterFingerprint: fingerprint,
            masterAsset,
            userId,

            // Inferred Basic Info
            trackTitle: file.name.replace(/\.[^/.]+$/, ""), // Strip extension
            durationSeconds: technical.duration,
            durationFormatted: this.formatDuration(technical.duration),
            durationDDEXFormatted: this.formatDurationDDEX(technical.duration),
            audioTechnical: masterAsset.audioProperties,

            // DDEX Fields from AI
            genre: semantic.ddexGenre || '', // Strict Validation: leave empty so UI wizard catches it
            subGenre: semantic.ddexSubGenre,
            language: semantic.language || '', // Strict Validation: leave empty so UI wizard catches it
            explicit: semantic.isExplicit,

            // Moods/Keywords
            mood: semantic.mood,
            keywords: semantic.marketingHooks.keywords,

            // Audio Technical Features
            bpm: technical.bpm,
            key: technical.key,
            energy: technical.energy,

            // Marketing — prefer dedicated field from Sonic Cortex Session 1
            marketingComment: semantic.marketingComment || semantic.marketingHooks.oneLiner,

            // Defaults for a "New Ingestion"
            releaseDate: new Date().toISOString().split('T')[0] ?? '',
            releaseType: 'Single',
            territories: ['Worldwide'],
            distributionChannels: ['streaming', 'download'],
            labelName: INGESTION_CONFIG.ENTITY_NAME,
            dpid: INGESTION_CONFIG.SYSTEM_IDENTIFIER,

            // Intelligence Content Disclosure (Goal 3 compliance — surfaced by Sonic Cortex aiArtifacts flag)
            aiGeneratedContent: {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: semantic.productionValue?.aiArtifacts ?? false
            },

            // Confidence Scores
            confidenceScores: {
                genre: technical.genre && Object.keys(technical.genre).length > 0 
                    ? Math.max(...Object.values(technical.genre)) : undefined,
                mood: technical.moods && Object.keys(technical.moods).length > 0
                    ? Math.max(...Object.values(technical.moods)) : undefined,
                danceability: technical.danceability_ml
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

    private formatDurationDDEX(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(3);
        return `PT${m}M${s}S`;
    }
}

export const trackIngestion = new TrackIngestionService();
