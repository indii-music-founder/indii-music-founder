import React, { memo, useCallback } from 'react';
import { Volume2, VolumeX, Headphones, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { VideoTrack, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { TimelineClip } from './TimelineClip';
import { PIXELS_PER_FRAME } from '../constants';
import { readCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';

export interface TimelineTrackProps {
    key?: React.Key;
    track: VideoTrack;
    clips: VideoClip[];
    selectedClipId: string | null;
    expandedClipIds: Set<string>;
    onRemoveTrack: (id: string) => void;
    onAddSampleClip: (trackId: string, type: 'text' | 'video' | 'image' | 'audio') => void;
    onToggleMuteTrack?: (id: string) => void;
    onToggleSoloTrack?: (id: string) => void;
    onToggleLockTrack?: (id: string) => void;

    // Passthrough props for clip
    onToggleExpand: (id: string) => void;
    onRemoveClip: (id: string) => void;
    onDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize-left' | 'resize-right') => void;
    onAddKeyframe: (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => void;
    onKeyframeClick: (e: React.MouseEvent, clipId: string, property: string, frame: number, easing?: string) => void;
}

export const TimelineTrack = memo(({
    track, clips, selectedClipId, expandedClipIds,
    onRemoveTrack, onAddSampleClip,
    onToggleMuteTrack, onToggleSoloTrack, onToggleLockTrack,
    onToggleExpand, onRemoveClip, onDragStart, onAddKeyframe, onKeyframeClick
}: TimelineTrackProps) => {
    const hasExpandedClip = clips.some(clip => expandedClipIds.has(clip.id));

    const handleToggleMute = useCallback(() => {
        if (onToggleMuteTrack) {
            onToggleMuteTrack(track.id);
        } else {
            useVideoEditorStore.getState().toggleMuteTrack?.(track.id);
        }
    }, [onToggleMuteTrack, track.id]);

    const handleToggleSolo = useCallback(() => {
        if (onToggleSoloTrack) {
            onToggleSoloTrack(track.id);
        } else {
            useVideoEditorStore.getState().toggleSoloTrack?.(track.id);
        }
    }, [onToggleSoloTrack, track.id]);

    const handleToggleLock = useCallback(() => {
        if (onToggleLockTrack) {
            onToggleLockTrack(track.id);
        } else {
            useVideoEditorStore.getState().toggleLockTrack?.(track.id);
        }
    }, [onToggleLockTrack, track.id]);

    return (
        <div
            data-track-id={track.id}
            data-testid={`timeline-track-${track.id}`}
            className="bg-gray-900 rounded flex flex-col relative group border border-gray-800 hover:border-gray-700 transition-colors mb-1"
        >
            <div className={`flex ${hasExpandedClip ? 'min-h-[64px] min-h-[220px] h-auto pb-2' : 'h-16'}`}>
                {/* Track Header */}
                <div className={`w-48 border-r border-gray-800 p-2 flex flex-col justify-between bg-gray-900 shrink-0 z-10 ${hasExpandedClip ? 'min-h-[220px] self-stretch' : ''}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-gray-300 truncate" title={track.name}>{track.name}</span>
                        <div className="flex items-center gap-1">
                            {/* Mute button */}
                            <button
                                type="button"
                                onClick={handleToggleMute}
                                data-testid={`track-mute-${track.id}`}
                                aria-label={track.isMuted ? `Unmute track ${track.name}` : `Mute track ${track.name}`}
                                aria-pressed={Boolean(track.isMuted)}
                                title={track.isMuted ? "Unmute Track" : "Mute Track"}
                                className={`p-1 rounded transition-colors ${
                                    track.isMuted ? 'text-red-400 bg-red-950/30' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {track.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                            </button>

                            {/* Solo button */}
                            <button
                                type="button"
                                onClick={handleToggleSolo}
                                data-testid={`track-solo-${track.id}`}
                                aria-label={track.isSolo ? `Unsolo track ${track.name}` : `Solo track ${track.name}`}
                                aria-pressed={Boolean(track.isSolo)}
                                title={track.isSolo ? "Solo Active" : "Solo Track"}
                                className={`p-1 rounded transition-colors ${
                                    track.isSolo ? 'text-yellow-400 bg-yellow-950/30 font-bold' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <Headphones size={12} />
                            </button>

                            {/* Lock button */}
                            <button
                                type="button"
                                onClick={handleToggleLock}
                                data-testid={`track-lock-${track.id}`}
                                aria-label={track.isLocked ? `Unlock track ${track.name}` : `Lock track ${track.name}`}
                                aria-pressed={Boolean(track.isLocked)}
                                title={track.isLocked ? "Unlock Track" : "Lock Track"}
                                className={`p-1 rounded transition-colors ${
                                    track.isLocked ? 'text-amber-400 bg-amber-950/30' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {track.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            disabled={track.isLocked}
                            onClick={() => !track.isLocked && onAddSampleClip(track.id, 'text')}
                            data-testid={`track-add-text-${track.id}`}
                            className={`text-[9px] px-1 py-0.5 rounded flex items-center gap-1 ${
                                track.isLocked ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                            }`}
                            title="Add Text"
                            aria-label="Add text clip"
                        >
                            <Plus size={10} /> Txt
                        </button>
                        <button
                            disabled={track.isLocked}
                            onClick={() => !track.isLocked && onAddSampleClip(track.id, 'video')}
                            data-testid={`track-add-video-${track.id}`}
                            className={`text-[9px] px-1 py-0.5 rounded flex items-center gap-1 ${
                                track.isLocked ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                            }`}
                            title="Add Video"
                            aria-label="Add video clip"
                        >
                            <Plus size={10} /> Vid
                        </button>
                        <button
                            disabled={track.isLocked}
                            onClick={() => !track.isLocked && onAddSampleClip(track.id, 'audio')}
                            data-testid={`track-add-audio-${track.id}`}
                            className={`text-[9px] px-1 py-0.5 rounded flex items-center gap-1 ${
                                track.isLocked ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                            }`}
                            title="Add Audio"
                            aria-label="Add audio clip"
                        >
                            <Plus size={10} /> Aud
                        </button>
                        <button
                            disabled={track.isLocked}
                            onClick={() => !track.isLocked && onRemoveTrack(track.id)}
                            data-testid={`track-delete-${track.id}`}
                            className={`ml-auto ${track.isLocked ? 'text-gray-700 cursor-not-allowed' : 'text-gray-600 hover:text-red-400'}`}
                            aria-label={`Delete track ${track.name}`}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                <div
                    data-testid={`track-drop-zone-${track.id}`}
                    className={`flex-1 relative bg-gray-900/50 ${
                        hasExpandedClip ? 'min-h-[64px] min-h-[220px] h-auto pb-2 overflow-visible' : 'overflow-hidden'
                    } ${track.isMuted ? 'opacity-60' : ''} ${track.isLocked ? 'cursor-not-allowed' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (track.isLocked) {
                            e.dataTransfer.dropEffect = 'none';
                            return;
                        }
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        if (track.isLocked) return;

                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const { useVideoEditorStore } = await import('../../store/videoEditorStore');
                        const zoom = useVideoEditorStore.getState().timelineZoom;
                        const frame = Math.max(0, Math.round(x / (PIXELS_PER_FRAME * zoom)));

                        const files = Array.from(e.dataTransfer.files) as File[];
                        const { getMediaDurationFromFile, resolveMediaDurationSeconds, durationSecondsToFrames } = await import('../utils/mediaMetadata');
                        const fps = useVideoEditorStore.getState().project?.fps || 30;

                        if (files.length > 0) {
                            const file = files[0]!;
                            const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'video';
                            const url = URL.createObjectURL(file);

                            const durationSeconds = type !== 'image' ? await getMediaDurationFromFile(file) : 0;
                            const durationInFrames = type === 'image' ? 90 : durationSecondsToFrames(durationSeconds, fps);

                            useVideoEditorStore.getState().addClip({
                                type,
                                trackId: track.id,
                                name: file.name,
                                startFrame: frame,
                                durationInFrames,
                                src: url,
                                opacity: 1,
                                scale: 1,
                                x: 0,
                                y: 0
                            });
                        } else {
                            try {
                                const data = readCreativeAssetDrag(e.dataTransfer);
                                if (data) {
                                    if (data.asset) {
                                        // ISSUE-923: canonical HistoryItem type for songs/stems is 'music' — map it
                                        // (and legacy 'audio') to an audio clip, never a video clip.
                                        if (!['image', 'video', 'music'].includes(data.asset.type)) return;
                                        const mediaType: 'video' | 'audio' | 'image' = data.asset.type === 'image' ? 'image' : data.asset.type === 'music' ? 'audio' : 'video';

                                        const durationSeconds = await resolveMediaDurationSeconds(data.asset.url, mediaType);
                                        const durationInFrames = mediaType === 'image' ? 90 : durationSecondsToFrames(durationSeconds, fps);

                                        useVideoEditorStore.getState().addClip({
                                            type: mediaType,
                                            trackId: track.id,
                                            name: data.asset.name,
                                            startFrame: frame,
                                            durationInFrames,
                                            src: data.asset.url,
                                            opacity: 1,
                                            scale: 1,
                                            x: 0,
                                            y: 0
                                        });
                                    }
                                }
                            } catch (_err) {
                                // Silent catch for invalid dropped JSON
                            }
                        }
                    }}
                >
                    {/* Grid lines */}
                    <div className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #1f2937 1px, transparent 1px)',
                            backgroundSize: `${30 * PIXELS_PER_FRAME}px 100%`
                        }}
                    />

                    {track.isLocked && (
                        <div
                            data-testid={`track-locked-indicator-${track.id}`}
                            className="absolute inset-0 bg-black/20 pointer-events-none z-30 flex items-center justify-end pr-4"
                        >
                            <div className="flex items-center gap-1 text-[10px] text-amber-400/80 bg-black/60 px-2 py-0.5 rounded border border-amber-500/20">
                                <Lock size={10} /> Locked
                            </div>
                        </div>
                    )}

                    {clips.map(clip => (
                        <TimelineClip
                            key={clip.id}
                            clip={clip}
                            isSelected={selectedClipId === clip.id}
                            isExpanded={expandedClipIds.has(clip.id)}
                            isLocked={track.isLocked}
                            onToggleExpand={onToggleExpand}
                            onRemove={onRemoveClip}
                            onDragStart={onDragStart}
                            onAddKeyframe={onAddKeyframe}
                            onKeyframeClick={onKeyframeClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});
