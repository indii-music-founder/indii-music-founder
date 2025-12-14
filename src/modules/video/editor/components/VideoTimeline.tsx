import React, { useState, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Plus } from 'lucide-react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { TimelineTrack } from './TimelineTrack';
import { PIXELS_PER_FRAME } from '../constants';
import { groupClipsByTrack, generateTimeRulerMarks } from '../utils/timelineUtils';

interface VideoTimelineProps {
    project: VideoProject;
    isPlaying: boolean;
    currentTime: number;
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

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
    project, isPlaying, currentTime, selectedClipId,
    handlePlayPause, handleSeek, handleAddTrack, handleAddSampleClip,
    removeTrack, removeClip, handleDragStart, formatTime
}) => {
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

    // 1. Memoize time ruler marks
    const timeRulerMarks = useMemo(() => {
        return generateTimeRulerMarks(project.durationInFrames, project.fps);
    }, [project.durationInFrames, project.fps]);

    // 2. Pre-group clips by track ID
    const clipsByTrack = useMemo(() => {
        return groupClipsByTrack(project.clips);
    }, [project.clips]);

    return (
        <div className="h-72 border-t border-gray-800 bg-gray-900 flex flex-col">
            {/* Timeline Controls */}
            <div className="h-12 border-b border-gray-800 flex items-center px-4 gap-4 bg-gray-900 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleSeek(0)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><SkipBack size={16} /></button>
                    <button onClick={handlePlayPause} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={() => handleSeek(project.durationInFrames)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><SkipForward size={16} /></button>
                </div>
                <div className="h-6 w-px bg-gray-700 mx-2"></div>
                <span className="text-xs text-purple-400 font-mono font-bold">{formatTime(0)}</span>
                <div className="flex-1"></div>
                <button onClick={handleAddTrack} className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300 transition-colors">
                    <Plus size={14} /> Add Track
                </button>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-950 relative">
                {/* Time Ruler */}
                <div
                    className="h-6 w-full border-b border-gray-800 mb-2 relative cursor-pointer hover:bg-gray-900"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const frame = Math.round(x / PIXELS_PER_FRAME);
                        handleSeek(Math.max(0, Math.min(frame, project.durationInFrames)));
                    }}
                >
                    {timeRulerMarks.map((mark) => (
                        <div key={mark.second} className="absolute top-0 bottom-0 border-l border-gray-800 text-[10px] text-gray-600 pl-1 pointer-events-none"
                            style={{ left: mark.position }}>
                            {mark.second}s
                        </div>
                    ))}
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                    style={{ left: (currentTime * PIXELS_PER_FRAME) + 8 }}
                >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"></div>
                </div>

                {project.tracks.map(track => (
                    <TimelineTrack
                        key={track.id}
                        track={track}
                        clips={clipsByTrack[track.id] || []}
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
                ))}

                {/* Add Track Button (Bottom) */}
                <div className="h-10 flex items-center justify-center border-2 border-dashed border-gray-800 rounded hover:border-gray-700 hover:bg-gray-900/50 cursor-pointer transition-all m-4" onClick={handleAddTrack} role="button">
                    <span className="text-xs text-gray-500 flex items-center gap-2"><Plus size={14} /> Add Track</span>
                </div>
            </div>
        </div>
    );
};
