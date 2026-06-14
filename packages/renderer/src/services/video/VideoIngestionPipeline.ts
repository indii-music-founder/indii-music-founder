import { logger } from '@/utils/logger';
import { useVideoEditorStore, VideoClip, VideoTrack } from '@/modules/creative/video/store/videoEditorStore';

export interface IngestionMediaAsset {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'image';
    src: string;
    durationSeconds: number;
}

export interface IngestionAudioSyncParams {
    bpm: number;
    transientTimestamps: number[]; // In seconds
}

export class VideoIngestionPipeline {
    /**
     * Ingests a media asset (uploaded clip, Veo B-roll, or audio file) into the current VideoEditorProject.
     * Snaps video clips to transient beat locations if audio synchronization parameters are provided.
     */
    static async ingestAsset(
        asset: IngestionMediaAsset,
        syncParams?: IngestionAudioSyncParams
    ): Promise<string> {
        logger.info(`[VideoIngestionPipeline] Ingesting asset: ${asset.name} (${asset.type})`);
        
        const store = useVideoEditorStore.getState();
        const fps = store.project?.fps || 30;
        
        // Ensure corresponding track exists
        const trackType = asset.type === 'audio' ? 'audio' : 'video';
        let targetTrack = store.project?.tracks.find(t => t.type === trackType);
        
        if (!targetTrack) {
            // Dynamically add a new track if not present
            const trackId = `track-${crypto.randomUUID().substring(0, 8)}`;
            const newTrack: VideoTrack = {
                id: trackId,
                name: trackType === 'audio' ? 'Audio Track' : 'Video Track',
                type: trackType
            };
            
            // Get current project tracks and add
            const updatedTracks = [...(store.project?.tracks || []), newTrack];
            store.updateProjectSettings({ tracks: updatedTracks });
            targetTrack = newTrack;
        }
        
        // Calculate frame placement
        let startFrame = 0;
        const durationInFrames = Math.round(asset.durationSeconds * fps);
        
        // Find end of last clip on this track to append
        const trackClips = (store.project?.clips || []).filter(c => c.trackId === targetTrack.id);
        if (trackClips.length > 0) {
            const lastClip = trackClips.reduce((prev, curr) => 
                (prev.startFrame + prev.durationInFrames) > (curr.startFrame + curr.durationInFrames) ? prev : curr
            );
            startFrame = lastClip.startFrame + lastClip.durationInFrames;
        }
        
        // If sync params (BPM/transients) are provided, snap the starting frame to the nearest beat
        if (syncParams && syncParams.transientTimestamps.length > 0) {
            const startSeconds = startFrame / fps;
            
            // Find closest transient timing after or near the current startSeconds
            const closestTransient = syncParams.transientTimestamps.reduce((prev, curr) => {
                return Math.abs(curr - startSeconds) < Math.abs(prev - startSeconds) ? curr : prev;
            });
            
            // Align start frame to the transient time
            startFrame = Math.round(closestTransient * fps);
            logger.info(`[VideoIngestionPipeline] Snapped clip "${asset.name}" start to transient beat: ${closestTransient}s (Frame ${startFrame})`);
        }
        
        const clipId = `clip-${crypto.randomUUID().substring(0, 8)}`;
        const newClip: VideoClip = {
            id: clipId,
            type: asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
            name: asset.name,
            src: asset.src,
            startFrame,
            durationInFrames,
            trackId: targetTrack.id,
            opacity: 1,
            scale: 1,
            volume: asset.type === 'audio' ? 0.8 : undefined
        };
        
        // Add the clip to the project state
        store.addClip(newClip);
        
        return clipId;
    }
}
