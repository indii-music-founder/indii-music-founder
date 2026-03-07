import { metadataOrchestrator } from '@/services/metadata/MetadataOrchestrator';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const MusicTools: Record<string, AnyToolFunction> = {
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
        const { ExtendedGoldenMetadataSchema } = await import('@/services/ddex/validation');
        
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
        fingerprint: string, 
        updates: Partial<any> 
    }) => {
        const { trackLibrary } = await import('@/services/metadata/TrackLibraryService');
        
        const existing = await trackLibrary.getByFingerprint(args.fingerprint);
        if (!existing) return toolError("Track not found in library.", "NOT_FOUND");

        const updated = { ...existing, ...args.updates, isGolden: false }; // Reset golden until re-verified
        await trackLibrary.saveTrack(updated);

        return toolSuccess(updated, `Updated metadata for "${updated.trackTitle}".`);
    }),

    scrub_id3_tags: wrapTool('scrub_id3_tags', async (args: { fileUrl: string; metadata: any }) => {
        // Mock Sync Metadata Scrubber (Item 176)
        return toolSuccess({
            fileUrl: args.fileUrl,
            status: 'ID3 Tags Auto-Populated',
            tagsWritten: ['TIT2 (Title)', 'TPE1 (Artist)', 'TALB (Album)', 'TCON (Genre)', 'COMM (Comments/Sync Info)']
        }, `ID3 tags auto-populated on downloadable WAV/MP3 file. Ready for sync export.`);
    }),

    inject_splits_to_metadata: wrapTool('inject_splits_to_metadata', async (args: { trackId: string; splits: Array<{ writer: string; percentage: number; ipi: string }> }) => {
        // Mock Split Sheet Metadata Injection (Item 178)
        return toolSuccess({
            trackId: args.trackId,
            injectedSplits: args.splits.length,
            status: 'Embedded in Distribution Blob'
        }, `Songwriter splits deeply embedded into the distribution metadata blob for track ${args.trackId}.`);
    }),

    export_dolby_atmos_stems: wrapTool('export_dolby_atmos_stems', async (args: { trackId: string; stemCount: number }) => {
        // Mock Spatial/Dolby Atmos Preparation (Item 192)
        return toolSuccess({
            trackId: args.trackId,
            stemCount: args.stemCount,
            spatialCoordinates: 'Auto-mapped via AI',
            exportFormat: 'ADM BWF',
            status: 'Ready for Atmos Mixing'
        }, `${args.stemCount} stems for track ${args.trackId} have been tagged with spatial coordinates and exported for Dolby Atmos mixing.`);
    })
};
