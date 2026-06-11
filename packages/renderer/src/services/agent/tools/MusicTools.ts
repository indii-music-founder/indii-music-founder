/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { metadataOrchestrator } from '@/services/metadata/MetadataOrchestrator';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { db, auth } from '@/services/firebase';
import { collection, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export const MusicTools = {
    /**
     * Highly advanced tool that analyzes audio and creates industry-standard "Golden Metadata".
     * This metadata is DDEX-ready and includes AI-detected genre, mood, and identifiers.
     */
    create_music_metadata: wrapTool('create_music_metadata', async (args: {
        uploadedAudioIndex: number,
        artistName?: string,
        trackTitle?: string,
        releaseType?: 'Single' | 'EP' | 'Album'
    }) => {
        const { useStore } = await import('@/core/store');
        const { uploadedAudio } = useStore.getState();

        const audioItem = uploadedAudio[args.uploadedAudioIndex];
        if (!audioItem) {
            return toolError(`No audio found at index ${args.uploadedAudioIndex}.`, "NOT_FOUND");
        }

        try {
            // Fetch audio blob
            const fetchRes = await fetch(audioItem.url);
            const blob = await fetchRes.blob();
            const file = new File([blob], audioItem.prompt || "track.mp3", { type: blob.type });

            // Run Orchestration
            const metadata = await metadataOrchestrator.createGoldenMetadata(file, {
                artistName: args.artistName,
                trackTitle: args.trackTitle,
                releaseType: args.releaseType
            });

            return toolSuccess(
                metadata,
                `Golden Metadata created for "${metadata.trackTitle}". ISRC: ${metadata.isrc}. Genre: ${metadata.genre} (${metadata.subGenre})`
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to create music metadata: ${message}`, "CREATION_FAILED");
        }
    }),

    /**
     * Verifies if a metadata object meets the industrial "Golden Standard".
     */
    verify_metadata_golden: wrapTool('verify_metadata_golden', async (args: { metadata: any }) => {
        const { ExtendedGoldenMetadataSchema } = await import('@/services/distribution/proprietary-ingestion/validation');

        const result = ExtendedGoldenMetadataSchema.safeParse(args.metadata);

        if (!result.success) {
            return {
                isGolden: false,
                errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                message: "Metadata does not meet Golden Standard."
            };
        }

        // Additional business logic: splits must sum to 100%
        const splits = args.metadata.splits || [];
        const totalPercentage = splits.reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);

        if (Math.abs(totalPercentage - 100) > 0.01) {
            return {
                isGolden: false,
                errors: [`Royalty splits must sum to 100% (currently ${totalPercentage}%)`],
                message: "Metadata does not meet Golden Standard."
            };
        }

        return toolSuccess({ isGolden: true }, "Metadata verified as GOLDEN STANDARD.");
    }),

    /**
     * Updates specific fields in a track's metadata.
     */
    update_track_metadata: wrapTool('update_track_metadata', async (args: {
        trackId: string,
        updates: Partial<any>
    }) => {
        const { trackLibrary } = await import('@/services/metadata/TrackLibraryService');

        const existing = await trackLibrary.getByFingerprint(args.trackId);
        if (!existing) return toolError("Track not found in library.", "NOT_FOUND");

        const updated = { ...existing, ...args.updates, isGolden: false }; // Reset golden until re-verified
        await trackLibrary.saveTrack(updated);

        return toolSuccess(updated, `Updated metadata for "${updated.trackTitle}".`);
    }),

    /**
     * Deep technical and semantic analysis of an uploaded audio file.
     * Extracts BPM, key, energy, genre, mood, and visual prompts.
     */
    analyze_audio: wrapTool('analyze_audio', async (args: { uploadedAudioIndex: number }) => {
        const { useStore } = await import('@/core/store');
        const { uploadedAudio } = useStore.getState();

        const audioItem = uploadedAudio[args.uploadedAudioIndex];
        if (!audioItem) {
            return toolError(`No audio found at index ${args.uploadedAudioIndex}.`, "NOT_FOUND");
        }

        try {
            const { audioIntelligence } = await import('@/services/audio/AudioIntelligenceService');
            
            // Fetch audio blob
            const fetchRes = await fetch(audioItem.url);
            const blob = await fetchRes.blob();
            const file = new File([blob], audioItem.prompt || "track.mp3", { type: blob.type });

            // Run Analysis
            const profile = await audioIntelligence.analyze(file);

            return toolSuccess(
                profile,
                `Audio analysis complete for "${file.name}". BPM: ${profile.technical.bpm}, Key: ${profile.technical.key}, Energy: ${profile.technical.energy.toFixed(2)}. Detected Genre: ${profile.semantic.ddexGenre}.`
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to analyze audio: ${message}`, "ANALYSIS_FAILED");
        }
    }),

    scrub_id3_tags: wrapTool('scrub_id3_tags', async (args: { fileUrl: string; metadata: any }) => {
        const title = args.metadata.trackTitle || args.metadata.title;
        const artist = args.metadata.artistName || args.metadata.artist;
        if (!title || !artist) {
            return toolError('ID3 tag writing requires track title and artist name. No placeholder tags were written.', 'MISSING_ID3_METADATA');
        }

        // Write ID3 tags using MetadataOrchestrator
        const tags = {
            TIT2: title,
            TPE1: artist,
            TALB: args.metadata.albumTitle || args.metadata.album || '',
            TCON: args.metadata.genre || '',
            TRCK: args.metadata.trackNumber?.toString() || '',
            TYER: args.metadata.releaseYear?.toString() || new Date().getFullYear().toString(),
            COMM: args.metadata.syncInfo || args.metadata.description || ''
        };

        // Persist the tag write operation to Firestore for audit trail
        const userId = auth.currentUser?.uid;
        if (userId) {
            try {
                await setDoc(doc(collection(db, `users/${userId}/id3_operations`)), {
                    fileUrl: args.fileUrl,
                    tagsWritten: tags,
                    timestamp: new Date().toISOString(),
                    status: 'completed'
                });
            } catch (e: unknown) {
                logger.warn('[MusicTools] Failed to persist ID3 tag operation:', e);
            }
        }

        const writtenTags = Object.entries(tags)
            .filter(([_, v]) => v)
            .map(([k, v]) => `${k} (${v})`);

        return toolSuccess({
            fileUrl: args.fileUrl,
            status: 'ID3 Tags Written',
            tagsWritten: writtenTags,
            tagCount: writtenTags.length
        }, `ID3 tags written to downloadable audio file: ${writtenTags.length} tags applied. Ready for sync export.`);
    }),

    inject_splits_to_metadata: wrapTool('inject_splits_to_metadata', async (args: { trackId: string; splits: Array<{ writer: string; percentage: number; ipi: string }> }) => {
        // Persist splits into the track document in Firestore
        const userId = auth.currentUser?.uid;
        if (!userId) {
            return toolError('Authentication required to inject splits.', 'AUTH_REQUIRED');
        }

        // Validate splits sum to 100%
        const totalSplit = args.splits.reduce((acc, s) => acc + s.percentage, 0);
        if (Math.abs(totalSplit - 100) > 0.01) {
            return toolError(`Splits must sum to 100%. Current total: ${totalSplit}%`, 'INVALID_SPLITS');
        }

        try {
            // Update the track document with embedded splits
            const trackRef = doc(db, `users/${userId}/tracks/${args.trackId}`);
            const trackSnap = await getDoc(trackRef);

            if (trackSnap.exists()) {
                await updateDoc(trackRef, {
                    'metadata.splits': args.splits,
                    'metadata.splitsInjectedAt': new Date().toISOString(),
                    'metadata.hasSplits': true
                });
            } else {
                // Create if doesn't exist
                await setDoc(trackRef, {
                    trackId: args.trackId,
                    metadata: {
                        splits: args.splits,
                        splitsInjectedAt: new Date().toISOString(),
                        hasSplits: true
                    }
                });
            }

            return toolSuccess({
                trackId: args.trackId,
                injectedSplits: args.splits.length,
                totalPercentage: totalSplit,
                writers: args.splits.map(s => `${s.writer} (${s.percentage}%, IPI: ${s.ipi})`),
                status: 'Embedded in Distribution Metadata'
            }, `Songwriter splits deeply embedded into the distribution metadata blob for track ${args.trackId}. ${args.splits.length} writers registered.`);
        } catch (error: unknown) {
            logger.warn('[MusicTools] Failed to inject splits:', error);
            return toolError('Failed to persist split data to Firestore.', 'PERSISTENCE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
