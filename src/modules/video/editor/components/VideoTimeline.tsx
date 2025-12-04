import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Plus, Trash2, Volume2, Eye, ChevronDown, ChevronRight, Diamond } from 'lucide-react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { AudioWaveform } from './AudioWaveform';

const PIXELS_PER_FRAME = 2;

// Helper icon component
const XIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

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

const ANIMATABLE_PROPERTIES = [
    { key: 'scale', label: 'Scale', min: 0, max: 2, step: 0.1, defaultValue: 1 },
    { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.1, defaultValue: 1 },
    { key: 'rotation', label: 'Rotation', min: 0, max: 360, step: 15, defaultValue: 0 },
    { key: 'x', label: 'Position X', min: -1000, max: 1000, step: 10, defaultValue: 0 },
    { key: 'y', label: 'Position Y', min: -1000, max: 1000, step: 10, defaultValue: 0 },
];

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
    project, isPlaying, currentTime, selectedClipId,
    handlePlayPause, handleSeek, handleAddTrack, handleAddSampleClip,
    removeTrack, removeClip, handleDragStart, formatTime
}) => {
    const { addKeyframe, removeKeyframe, updateKeyframe } = useVideoEditorStore();
    const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(new Set());

    const toggleExpand = (clipId: string) => {
        const newSet = new Set(expandedClipIds);
        if (newSet.has(clipId)) {
            newSet.delete(clipId);
        } else {
            newSet.add(clipId);
        }
        setExpandedClipIds(newSet);
    };

    const handleAddKeyframe = (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => {
        e.stopPropagation();
        // Calculate frame relative to clip start
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const frameOffset = Math.round(clickX / PIXELS_PER_FRAME);

        // Ensure frame is within clip bounds
        const frame = Math.max(0, Math.min(frameOffset, clip.durationInFrames));

        // Use existing value at this frame if possible, or default
        // Simple interpolation logic could go here, but for now use default
        addKeyframe(clip.id, property, frame, defaultValue);
    };

    const handleKeyframeClick = (e: React.MouseEvent, clipId: string, property: string, frame: number, currentEasing?: string) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent default context menu if right click, though we handle that separately

        if (e.type === 'contextmenu') {
            removeKeyframe(clipId, property, frame);
            return;
        }

        // Cycle easing: linear -> easeIn -> easeOut -> easeInOut -> linear
        let nextEasing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' = 'linear';
        if (!currentEasing || currentEasing === 'linear') nextEasing = 'easeIn';
        else if (currentEasing === 'easeIn') nextEasing = 'easeOut';
        else if (currentEasing === 'easeOut') nextEasing = 'easeInOut';
        else if (currentEasing === 'easeInOut') nextEasing = 'linear';

        updateKeyframe(clipId, property, frame, { easing: nextEasing });
    };

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
                    {Array.from({ length: Math.ceil(project.durationInFrames / 30) }).map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-gray-800 text-[10px] text-gray-600 pl-1 pointer-events-none" style={{ left: i * 30 * PIXELS_PER_FRAME }}>
                            {i}s
                        </div>
                    ))}
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                    style={{ left: (currentTime * PIXELS_PER_FRAME) + 8 }} // +8 for padding-left of container (p-2)
                >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"></div>
                </div>

                {project.tracks.map(track => (
                    <div key={track.id} className="bg-gray-900 rounded flex flex-col relative group border border-gray-800 hover:border-gray-700 transition-colors">
                        <div className="flex h-20">
                            {/* Track Header */}
                            <div className="w-48 border-r border-gray-800 p-2 flex flex-col justify-between bg-gray-900 shrink-0 z-10">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-300 truncate" title={track.name}>{track.name}</span>
                                    <div className="flex gap-1">
                                        <button className="text-gray-600 hover:text-gray-400"><Eye size={12} /></button>
                                        <button className="text-gray-600 hover:text-gray-400"><Volume2 size={12} /></button>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAddSampleClip(track.id, 'text')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Text">
                                        <Plus size={10} /> Txt
                                    </button>
                                    <button onClick={() => handleAddSampleClip(track.id, 'video')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Video">
                                        <Plus size={10} /> Vid
                                    </button>
                                    <button onClick={() => handleAddSampleClip(track.id, 'audio')} className="text-[10px] bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 flex items-center gap-1" title="Add Audio">
                                        <Plus size={10} /> Aud
                                    </button>
                                    <button onClick={() => removeTrack(track.id)} className="text-gray-600 hover:text-red-400 ml-auto">
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

                                {project.clips.filter(c => c.trackId === track.id).map(clip => {
                                    const isExpanded = expandedClipIds.has(clip.id);

                                    return (
                                        <div
                                            key={clip.id}
                                            className={`absolute top-2 border rounded cursor-pointer transition-all group/clip ${selectedClipId === clip.id ? 'bg-purple-600 border-purple-400 ring-1 ring-white' : 'bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/50'}`}
                                            style={{
                                                left: clip.startFrame * PIXELS_PER_FRAME,
                                                width: clip.durationInFrames * PIXELS_PER_FRAME,
                                                height: isExpanded ? 'auto' : '64px', // Auto height when expanded
                                                zIndex: isExpanded ? 20 : 10
                                            }}
                                            onMouseDown={(e) => handleDragStart(e, clip, 'move')}
                                        >
                                            {/* Clip Content */}
                                            <div className="px-2 py-1 flex items-center justify-between h-8 overflow-hidden pointer-events-none relative z-10">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleExpand(clip.id);
                                                        }}
                                                        className="pointer-events-auto p-0.5 hover:bg-black/20 rounded text-white/70 hover:text-white"
                                                    >
                                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                    </button>
                                                    <span className="text-[10px] text-white truncate font-medium drop-shadow-md">{clip.name}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeClip(clip.id);
                                                    }}
                                                    className="opacity-0 group-hover/clip:opacity-100 text-purple-200 hover:text-white transition-opacity pointer-events-auto"
                                                >
                                                    <XIcon size={12} />
                                                </button>
                                            </div>

                                            {/* Audio Waveform */}
                                            {clip.type === 'audio' && clip.src && (
                                                <div className="absolute top-0 left-0 right-0 h-16 z-0 opacity-50 pointer-events-none">
                                                    <AudioWaveform
                                                        src={clip.src}
                                                        width={clip.durationInFrames * PIXELS_PER_FRAME}
                                                        height={64}
                                                        color="rgba(255, 255, 255, 0.6)"
                                                    />
                                                </div>
                                            )}

                                            {/* Keyframe Editor Rows */}
                                            {isExpanded && (
                                                <div className="mt-2 bg-black/40 border-t border-white/10 pb-2">
                                                    {ANIMATABLE_PROPERTIES.map(prop => (
                                                        <div key={prop.key} className="h-6 flex items-center relative group/row hover:bg-white/5">
                                                            {/* Label (Sticky left?) - Hard to sticky inside absolute. Just show on hover or overlay */}
                                                            <div className="absolute left-0 top-0 bottom-0 w-20 bg-black/60 backdrop-blur-sm flex items-center px-2 text-[9px] text-gray-400 border-r border-white/5 z-20">
                                                                {prop.label}
                                                            </div>

                                                            {/* Keyframe Track */}
                                                            <div
                                                                className="absolute left-20 right-0 top-0 bottom-0 cursor-crosshair"
                                                                onClick={(e) => handleAddKeyframe(e, clip, prop.key, prop.defaultValue)}
                                                            >
                                                                {/* Center Line */}
                                                                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 group-hover/row:bg-white/20"></div>

                                                                {/* Keyframes */}
                                                                {clip.keyframes?.[prop.key]?.map((kf, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 hover:scale-150 transition-transform cursor-pointer z-30 shadow-sm shadow-black ${kf.easing === 'easeIn' ? 'bg-blue-400' :
                                                                                kf.easing === 'easeOut' ? 'bg-green-400' :
                                                                                    kf.easing === 'easeInOut' ? 'bg-purple-400' :
                                                                                        'bg-yellow-400'
                                                                            }`}
                                                                        style={{ left: kf.frame * PIXELS_PER_FRAME }}
                                                                        onClick={(e) => handleKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing)}
                                                                        onContextMenu={(e) => handleKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing)}
                                                                        title={`${prop.label}: ${kf.value} @ f${kf.frame} (${kf.easing || 'linear'})`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Resize Handle */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/50 transition-colors z-20"
                                                onMouseDown={(e) => handleDragStart(e, clip, 'resize')}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Track Button (Bottom) */}
                <div className="h-10 flex items-center justify-center border-2 border-dashed border-gray-800 rounded hover:border-gray-700 hover:bg-gray-900/50 cursor-pointer transition-all m-4" onClick={handleAddTrack} role="button">
                    <span className="text-xs text-gray-500 flex items-center gap-2"><Plus size={14} /> Add Track</span>
                </div>
            </div>
        </div>
    );
};
