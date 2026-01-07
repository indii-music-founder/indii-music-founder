import React, { memo } from 'react';
import { VideoTrack, VideoClip } from '../../store/videoEditorStore';
import { TimelineTrack } from './TimelineTrack';

interface TrackListProps {
    tracks: VideoTrack[];
    clipsByTrack: Record<string, VideoClip[]>;
    selectedClipId: string | null;
    expandedClipIds: Set<string>;
    onRemoveTrack: (id: string) => void;
    onAddSampleClip: (trackId: string, type: 'text' | 'video' | 'image' | 'audio') => void;
    onToggleExpand: (id: string) => void;
    onRemoveClip: (id: string) => void;
    onDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => void;
    onAddKeyframe: (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => void;
    onKeyframeClick: (e: React.MouseEvent, clipId: string, property: string, frame: number, easing?: string) => void;
}

export const TrackList = memo(({
    tracks,
    clipsByTrack,
    selectedClipId,
    expandedClipIds,
    onRemoveTrack,
    onAddSampleClip,
    onToggleExpand,
    onRemoveClip,
    onDragStart,
    onAddKeyframe,
    onKeyframeClick
}: TrackListProps) => {
    return (
        <>
            {tracks.map(track => (
                <TimelineTrack
                    key={track.id}
                    track={track}
                    clips={clipsByTrack[track.id] || []}
                    selectedClipId={selectedClipId}
                    expandedClipIds={expandedClipIds}
                    onRemoveTrack={onRemoveTrack}
                    onAddSampleClip={onAddSampleClip}
                    onToggleExpand={onToggleExpand}
                    onRemoveClip={onRemoveClip}
                    onDragStart={onDragStart}
                    onAddKeyframe={onAddKeyframe}
                    onKeyframeClick={onKeyframeClick}
                />
            ))}
        </>
    );
});

TrackList.displayName = 'TrackList';
