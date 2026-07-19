import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { SyncMood } from './LicensingService';
import { IngestionMapper } from '@/services/distribution/proprietary-ingestion/IngestionMapper';

export class SyncMetadataTaggingService {
    private readonly RELEASES_COLLECTION = 'proprietaryIngestionReleases';

    /**
     * Map arbitrary AI mood strings to standardized supervisor-friendly SyncMood options.
     */
    mapToSyncMoods(aiMoods: string[]): SyncMood[] {
        const syncMoodMap: Record<string, SyncMood> = {
            cinematic: 'Cinematic',
            epic: 'Cinematic',
            orchestral: 'Cinematic',
            atmospheric: 'Cinematic',
            dramatic: 'Cinematic',
            upbeat: 'Upbeat',
            happy: 'Upbeat',
            joyful: 'Upbeat',
            energetic: 'Energetic',
            hype: 'Energetic',
            driving: 'Energetic',
            aggressive: 'Energetic',
            melancholic: 'Melancholic',
            sad: 'Melancholic',
            somber: 'Melancholic',
            reflective: 'Melancholic',
            dark: 'Dark',
            eerie: 'Dark',
            ominous: 'Dark',
            spooky: 'Dark',
            chill: 'Chill',
            relaxed: 'Chill',
            calm: 'Chill',
            smooth: 'Chill',
            romantic: 'Romantic',
            sensual: 'Romantic',
            love: 'Romantic',
            triumphant: 'Triumphant',
            heroic: 'Triumphant',
            victorious: 'Triumphant',
            proud: 'Triumphant'
        };

        const mappedMoods = new Set<SyncMood>();
        for (const mood of aiMoods) {
            const normalized = mood.toLowerCase().trim();
            // Direct map lookup
            if (syncMoodMap[normalized]) {
                mappedMoods.add(syncMoodMap[normalized]);
            }
            // Substring mapping
            for (const [key, syncMood] of Object.entries(syncMoodMap)) {
                if (normalized.includes(key)) {
                    mappedMoods.add(syncMood);
                }
            }
        }

        // Return standard fallback if no match found
        return mappedMoods.size > 0 ? Array.from(mappedMoods) : ['Chill'];
    }

    /**
     * Propagate extracted AI semantic metadata tags to the release catalog.
     */
    async syncTagsToRelease(releaseId: string, profile: AudioIntelligenceProfile): Promise<void> {
        try {
            logger.info(`[SyncMetadataTagging] Propagating AI tags to release: ${releaseId}`);
            const releaseRef = doc(db, this.RELEASES_COLLECTION, releaseId);
            const snap = await getDoc(releaseRef);

            if (!snap.exists()) {
                throw new Error(`Release document ${releaseId} not found in ${this.RELEASES_COLLECTION}`);
            }

            const currentData = snap.data();
            const currentMetadata = currentData.metadata || {};

            // Map standard ingestion metadata fields
            const aiMetadata = IngestionMapper.mapAudioProfileToMetadata(profile);

            // Extract & map standard sync supervisor moods
            const rawMoods = profile.semantic?.mood || [];
            const syncMoods = this.mapToSyncMoods(rawMoods);

            const mergedMetadata = {
                ...currentMetadata,
                ...aiMetadata,
                // Ensure mood is formatted correctly for the SyncBriefMatcher
                mood: syncMoods,
            };

            const audioFeatures = {
                bpm: profile.technical.bpm,
                key: profile.technical.key,
                energy: profile.technical.energy,
                danceability: profile.technical.danceability,
                valence: profile.technical.valence || null
            };

            await updateDoc(releaseRef, {
                metadata: mergedMetadata,
                audioFeatures,
                updatedAt: new Date().toISOString()
            });

            logger.info(`[SyncMetadataTagging] Successfully synced tags and audio features to release ${releaseId}`);
        } catch (error: unknown) {
            logger.error(`[SyncMetadataTagging] Sync tags to release ${releaseId} failed:`, error);
            throw error;
        }
    }

    /**
     * Find release by track fingerprint (hash) and update metadata
     */
    async syncTagsByFingerprint(fingerprint: string, profile: AudioIntelligenceProfile): Promise<void> {
        try {
            const q = query(
                collection(db, this.RELEASES_COLLECTION),
                where('metadata.masterFingerprint', '==', fingerprint)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                logger.warn(`[SyncMetadataTagging] No release found matching fingerprint: ${fingerprint}`);
                return;
            }

            for (const d of snapshot.docs) {
                await this.syncTagsToRelease(d.id, profile);
            }
        } catch (error: unknown) {
            logger.error(`[SyncMetadataTagging] Sync tags by fingerprint failed:`, error);
            throw error;
        }
    }
}

export const syncMetadataTaggingService = new SyncMetadataTaggingService();
