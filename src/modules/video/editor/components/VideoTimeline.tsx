import React, { useState, useMemo, useCallback, memo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Plus } from 'lucide-react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { TimeRuler } from './TimeRuler';
import { TrackList } from './TrackList';
import { Playhead } from './Playhead';
import { PIXELS_PER_FRAME } from '../constants';
import { groupClipsByTrack } from '../utils/timelineUtils';

interface VideoTimelineProps {
    project: VideoProject;
    isPlaying: boolean;
    // currentTime removed from props to prevent re-renders
    selectedClipId: string | null;
    handlePlayPause: () => void;
    handleSeek: (frame: number) => void;
    handleAddTrack: () => void;
    handleAddSampleClip: (trackId: string, type: 'text' | 'video' | 'image' | 'audio') => void;
    removeTrack: (id: string) => void;
    removeClip: (id: string) => void;
    handleDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => void;
    formatTime: (frame: number) => string;
}

export const VideoTimeline = memo(({
    project, isPlaying, selectedClipId,
    handlePlayPause, handleSeek, handleAddTrack, handleAddSampleClip,
    removeTrack, removeClip, handleDragStart, formatTime
}: VideoTimelineProps) => {
    const { addKeyframe, removeKeyframe, updateKeyframe } = useVideoEditorStore();
    const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(() => new Set());

    const toggleExpand = useCallback((clipId: string) => {
        setExpandedClipIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clipId)) {
                newSet.delete(clipId);
            } else {
                newSet.add(clipId);
            }
            return newSet;
        });
    }, []);

    const handleAddKeyframe = useCallback((e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const frameOffset = Math.round(clickX / PIXELS_PER_FRAME);
        const frame = Math.max(0, Math.min(frameOffset, clip.durationInFrames));
        addKeyframe(clip.id, property, frame, defaultValue);
    }, [addKeyframe]);

    const handleKeyframeClick = useCallback((e: React.MouseEvent, clipId: string, property: string, frame: number, currentEasing?: string) => {
        e.stopPropagation();
        e.preventDefault();

        if (e.type === 'contextmenu') {
            removeKeyframe(clipId, property, frame);
            return;
        }

        let nextEasing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' = 'linear';
        if (!currentEasing || currentEasing === 'linear') nextEasing = 'easeIn';
        else if (currentEasing === 'easeIn') nextEasing = 'easeOut';
        else if (currentEasing === 'easeOut') nextEasing = 'easeInOut';
        else if (currentEasing === 'easeInOut') nextEasing = 'linear';

        updateKeyframe(clipId, property, frame, { easing: nextEasing });
    }, [removeKeyframe, updateKeyframe]);

    // 1. Pre-group clips by track ID
    const clipsByTrack = useMemo(() => {
        return groupClipsByTrack(project.clips);
    }, [project.clips]);

    return (
        <div className="h-full border-t border-[--border] bg-[--card] flex flex-col">
            {/* Timeline Controls */}
            <div className="h-12 border-b border-[--border] flex items-center px-4 gap-4 bg-[--card] z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleSeek(0)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label="Skip to start"><SkipBack size={16} /></button>
                    <button onClick={handlePlayPause} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={() => handleSeek(project.durationInFrames)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label="Skip to end"><SkipForward size={16} /></button>
                </div>
                <div className="h-6 w-px bg-gray-700 mx-2"></div>
                {/* Use formatTime from props, but pass 0 for start or use a store-connected time display if needed.
                    Since this is a control bar, showing current time might be needed.
                    However, passing currentTime re-renders the whole component.
                    We can make a separate ConnectedTimeDisplay if needed, but for now displaying 00:00:00 as start marker is fine
                    or the user intention was to show current time.
                    Wait, the original code showed `formatTime(0)`. That is static!
                    It shows "00:00:00". So it's fine.
                */}
                <span className="text-xs text-[--primary] font-mono font-bold">{formatTime(0)}</span>
                <div className="flex-1"></div>
                <button onClick={handleAddTrack} className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300 transition-colors">
                    <Plus size={14} /> Add Track
                </button>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[--background] relative">
                {/* Time Ruler (Optimized) */}
                <TimeRuler
                    durationInFrames={project.durationInFrames}
                    fps={project.fps}
                    onSeek={handleSeek}
                />

                {/* Playhead (Self-connected to store) */}
                <Playhead />

                {/* Optimized Track List */}
                <TrackList
                    tracks={project.tracks}
                    clipsByTrack={clipsByTrack}
                    selectedClipId={selectedClipId}
                    expandedClipIds={expandedClipIds}
                    onRemoveTrack={removeTrack}
                    onAddSampleClip={handleAddSampleClip}
                    onToggleExpand={toggleExpand}
                    onRemoveClip={removeClip}
                    onDragStart={handleDragStart}
                    onAddKeyframe={handleAddKeyframe}
                    onKeyframeClick={handleKeyframeClick}
                />

                {/* Add Track Button (Bottom) */}
                <div
                    className="h-10 flex items-center justify-center border-2 border-dashed border-[--border] rounded hover:border-[--primary]/50 hover:bg-[--muted]/50 cursor-pointer transition-all m-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                    onClick={handleAddTrack}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleAddTrack()}
                    role="button"
                    tabIndex={0}
                    aria-label="Add new track"
                >
                    <span className="text-xs text-gray-500 flex items-center gap-2"><Plus size={14} /> Add Track</span>
                </div>
            </div>
        </div>
    );
});

VideoTimeline.displayName = 'VideoTimeline';
