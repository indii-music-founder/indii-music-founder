import { useStore } from '@/core/store';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const MusicTools: Record<string, AnyToolFunction> = {
    analyze_audio: wrapTool('analyze_audio', async (args: { filePath: string }) => {
        if (!window.electronAPI?.audio) {
            return toolError("Audio Engine not available via Electron API.", "ENGINE_UNAVAILABLE");
        }

        const result = await window.electronAPI.audio.analyze(args.filePath);
        return toolSuccess(result, "Audio analysis completed.");
    }),

    get_audio_metadata: wrapTool('get_audio_metadata', async (args: { hash: string }) => {
        if (!window.electronAPI?.audio) {
            return toolError("Audio Engine not available.", "ENGINE_UNAVAILABLE");
        }

        const metadata = await window.electronAPI.audio.getMetadata(args.hash);
        if (!metadata) {
            return toolError("No metadata found for this hash.", "NOT_FOUND");
        }

        return toolSuccess(metadata, "Metadata lookup successful.");
    }),

    save_track_idea: wrapTool('save_track_idea', async (args: { title: string; notes?: string }) => {
        const { MusicService } = await import('@/services/music/MusicService');
        const { TrackStatus } = await import('@/modules/music/types');
        const { userProfile } = useStore.getState();
        const artistName = userProfile?.displayName || 'Me';

        const id = await MusicService.addTrack({
            title: args.title,
            artist: artistName,
            version: '1.0',
            tags: [],
            metadata: { notes: args.notes || '' },
            status: TrackStatus.DEMO
        });

        return toolSuccess({
            id,
            title: args.title
        }, `Saved track idea "${args.title}" (ID: ${id})`);
    }),

    create_playlist: wrapTool('create_playlist', async (args: { name: string; description?: string }) => {
        const { MusicService } = await import('@/services/music/MusicService');
        const id = await MusicService.createPlaylist({
            name: args.name,
            description: args.description || '',
            tracks: []
        });

        return toolSuccess({
            id,
            name: args.name
        }, `Created playlist "${args.name}" (ID: ${id})`);
    })
};
