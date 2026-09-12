import React, { useState, useCallback, memo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Plus } from 'lucide-react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { useShallow } from 'zustand/react/shallow';
import { TimeRuler } from './TimeRuler';
import { TrackList } from './TrackList';
import { Playhead } from './Playhead';
import { TimelineTimecode } from './TimelineTimecode';
import { PIXELS_PER_FRAME, TOTAL_TRACK_HEADER_OFFSET } from '../constants';
import { useStableGroupedClips } from '../hooks/useStableGroupedClips';
import { useSnapIndicatorStore } from '../hooks/useTimelineDrag';

interface VideoTimelineProps {
    project: VideoProject;
    // currentTime removed from props to prevent re-renders
    selectedClipId: string | null;
    handlePlayPause: () => void;
    handleSeek: (frame: number) => void;
    handleAddTrack: () => void;
    handleAddSampleClip: (trackId: string, type: 'text' | 'video' | 'image' | 'audio') => void;
    removeTrack: (id: string) => void;
    removeClip: (id: string) => void;
    handleDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize-left' | 'resize-right') => void;
    formatTime: (frame: number) => string;
    snapIndicatorFrame?: number | null;
    onToggleMuteTrack?: (id: string) => void;
    onToggleSoloTrack?: (id: string) => void;
    onToggleHideTrack?: (id: string) => void;
    onToggleLockTrack?: (id: string) => void;
}

export const VideoTimeline = memo(({
    project, selectedClipId,
    handlePlayPause, handleSeek, handleAddTrack, handleAddSampleClip,
    removeTrack, removeClip, handleDragStart, formatTime: _formatTime,
    snapIndicatorFrame: snapIndicatorFrameProp,
    onToggleMuteTrack, onToggleSoloTrack, onToggleHideTrack, onToggleLockTrack
}: VideoTimelineProps) => {

    const { isPlaying, addKeyframe, removeKeyframe, updateKeyframe, toggleMuteTrack, toggleSoloTrack, toggleHideTrack, toggleLockTrack } = useVideoEditorStore(
        useShallow((state) => ({
            isPlaying: state.isPlaying,
            addKeyframe: state.addKeyframe,
            removeKeyframe: state.removeKeyframe,
            updateKeyframe: state.updateKeyframe,
            toggleMuteTrack: state.toggleMuteTrack,
            toggleSoloTrack: state.toggleSoloTrack,
            toggleHideTrack: state.toggleHideTrack,
            toggleLockTrack: state.toggleLockTrack,
        }))
    );
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
        const zoom = useVideoEditorStore.getState().timelineZoom;
        const frameOffset = Math.round(clickX / (PIXELS_PER_FRAME * zoom));
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

    // 1. Pre-group clips by track ID with optimization for partial updates
    // This prevents re-rendering all tracks when only one track's clips change
    const clipsByTrack = useStableGroupedClips(project.clips);

    const storeSnapFrame = useSnapIndicatorStore(state => state.snapIndicatorFrame);
    const activeSnapFrame = snapIndicatorFrameProp !== undefined ? snapIndicatorFrameProp : storeSnapFrame;
    const timelineZoom = useVideoEditorStore(state => state.timelineZoom);
    const pxPerFrame = PIXELS_PER_FRAME * (timelineZoom || 1);
    const snapGuideLeft = (activeSnapFrame !== null && activeSnapFrame !== undefined)
        ? TOTAL_TRACK_HEADER_OFFSET + (activeSnapFrame * pxPerFrame)
        : 0;

    return (
        <div className="h-full border-t border-[--border] bg-[--card] flex flex-col">
            {/* Timeline Controls */}
            <div className="h-10 border-b border-[--border] flex items-center px-4 gap-3 bg-[--card] z-10">
                <div className="flex items-center gap-1.5">
                    <button onClick={() => handleSeek(0)} data-testid="timeline-skip-start" className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label="Skip to start"><SkipBack size={14} /></button>
                    <button onClick={handlePlayPause} data-testid="timeline-play-pause" className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => handleSeek(project.durationInFrames)} data-testid="timeline-skip-end" className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white" aria-label="Skip to end"><SkipForward size={14} /></button>
                </div>
                <div className="h-4 w-px bg-gray-700 mx-1"></div>
                <TimelineTimecode />
                <div className="flex-1"></div>
                <button onClick={handleAddTrack} data-testid="timeline-add-track-top" className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-300 transition-colors">
                    <Plus size={12} /> Add Track
                </button>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 overflow-y-auto p-2 pb-24 space-y-2 bg-[--background] relative">
                {/* Time Ruler (Optimized) */}
                <TimeRuler
                    durationInFrames={project.durationInFrames}
                    fps={project.fps}
                    onSeek={handleSeek}
                />

                {/* Playhead (Self-connected to store, aligned with 192px track header + 8px padding) */}
                <Playhead trackHeaderOffset={TOTAL_TRACK_HEADER_OFFSET} />

                {/* Magnetic Snapping Visual Guide Indicator */}
                {activeSnapFrame !== null && activeSnapFrame !== undefined && (
                    <div
                        data-testid="snap-guide"
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-40 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                        style={{ left: snapGuideLeft }}
                    />
                )}

                {/* Optimized Track List */}
                <TrackList
                    tracks={project.tracks}
                    clipsByTrack={clipsByTrack}
                    selectedClipId={selectedClipId}
                    expandedClipIds={expandedClipIds}
                    onRemoveTrack={removeTrack}
                    onAddSampleClip={handleAddSampleClip}
                    onToggleMuteTrack={onToggleMuteTrack || toggleMuteTrack}
                    onToggleSoloTrack={onToggleSoloTrack || toggleSoloTrack}
                    onToggleHideTrack={onToggleHideTrack || toggleHideTrack}
                    onToggleLockTrack={onToggleLockTrack || toggleLockTrack}
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
                    data-testid="timeline-add-track-bottom"
                >
                    <span className="text-xs text-gray-500 flex items-center gap-2"><Plus size={14} /> Add Track</span>
                </div>
            </div>
        </div>
    );
});

VideoTimeline.displayName = 'VideoTimeline';
