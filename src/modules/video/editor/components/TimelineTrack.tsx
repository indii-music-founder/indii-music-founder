import React, { memo } from 'react';
import { Eye, Volume2, Plus, Trash2 } from 'lucide-react';
import { VideoTrack, VideoClip } from '../../store/videoEditorStore';
import { TimelineClip } from './TimelineClip';
import { PIXELS_PER_FRAME } from '../constants';

export interface TimelineTrackProps {
    track: VideoTrack;
    clips: VideoClip[];
    selectedClipId: string | null;
    expandedClipIds: Set<string>;
    onRemoveTrack: (id: string) => void;
    onAddSampleClip: (trackId: string, type: 'text' | 'video' | 'image' | 'audio') => void;

    // Passthrough props for clip
    onToggleExpand: (id: string) => void;
    onRemoveClip: (id: string) => void;
    onDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => void;
    onAddKeyframe: (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => void;
    onKeyframeClick: (e: React.MouseEvent, clipId: string, property: string, frame: number, easing?: string) => void;
}

export const TimelineTrack = memo(({
    track, clips, selectedClipId, expandedClipIds,
    onRemoveTrack, onAddSampleClip,
    onToggleExpand, onRemoveClip, onDragStart, onAddKeyframe, onKeyframeClick
}: TimelineTrackProps) => {
    return (
        <div className="bg-gray-900 rounded flex flex-col relative group border border-gray-800 hover:border-gray-700 transition-colors">
            <div className="flex h-20">
                {/* Track Header */}
                <div className="w-48 border-r border-gray-800 p-2 flex flex-col justify-between bg-gray-900 shrink-0 z-10">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300 truncate" title={track.name}>{track.name}</span>
                        <div className="flex gap-1">
                            <button className="text-gray-600 hover:text-gray-400" aria-label={`Toggle visibility for track ${track.name}`}><Eye size={12} /></button>
                            <button className="text-gray-600 hover:text-gray-400" aria-label={`Toggle mute for track ${track.name}`}><Volume2 size={12} /></button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onAddSampleClip(track.id, 'text')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Text" aria-label="Add text clip">
                            <Plus size={10} /> Txt
                        </button>
                        <button onClick={() => onAddSampleClip(track.id, 'video')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Video" aria-label="Add video clip">
                            <Plus size={10} /> Vid
                        </button>
                        <button onClick={() => onAddSampleClip(track.id, 'audio')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Audio" aria-label="Add audio clip">
                            <Plus size={10} /> Aud
                        </button>
                        <button onClick={() => onRemoveTrack(track.id)} className="text-gray-600 hover:text-red-400 ml-auto" aria-label={`Delete track ${track.name}`}>
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                {/* Track Timeline */}
                <div className="flex-1 relative overflow-hidden bg-gray-900/50">
                    {/* Grid lines */}
                    <div className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #1f2937 1px, transparent 1px)',
                            backgroundSize: `${30 * PIXELS_PER_FRAME}px 100%`
                        }}
                    />

                    {clips.map(clip => (
                        <TimelineClip
                            key={clip.id}
                            clip={clip}
                            isSelected={selectedClipId === clip.id}
                            isExpanded={expandedClipIds.has(clip.id)}
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
