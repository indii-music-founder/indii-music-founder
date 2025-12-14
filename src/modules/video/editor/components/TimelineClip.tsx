import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { VideoClip } from '../../store/videoEditorStore';
import { AudioWaveform } from '../components/AudioWaveform'; // Check path relative to new file location? No, this is in components dir.
import { getKeyframeColor } from '../utils/keyframeUtils';
import { PIXELS_PER_FRAME, ANIMATABLE_PROPERTIES } from '../constants';

const XIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

interface TimelineClipProps {
    clip: VideoClip;
    isSelected: boolean;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    onRemove: (id: string) => void;
    onDragStart: (e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => void;
    onAddKeyframe: (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => void;
    onKeyframeClick: (e: React.MouseEvent, clipId: string, property: string, frame: number, easing?: string) => void;
}

export const TimelineClip = memo(({
    clip, isSelected, isExpanded,
    onToggleExpand, onRemove, onDragStart,
    onAddKeyframe, onKeyframeClick
}: TimelineClipProps) => {
    return (
        <div
            className={`absolute top-2 border rounded cursor-pointer transition-all group/clip ${isSelected ? 'bg-purple-600 border-purple-400 ring-1 ring-white' : 'bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/50'}`}
            style={{
                left: clip.startFrame * PIXELS_PER_FRAME,
                width: clip.durationInFrames * PIXELS_PER_FRAME,
                height: isExpanded ? 'auto' : '64px',
                zIndex: isExpanded ? 20 : 10
            }}
            onMouseDown={(e) => onDragStart(e, clip, 'move')}
        >
            {/* Clip Content */}
            <div className="px-2 py-1 flex items-center justify-between h-8 overflow-hidden pointer-events-none relative z-10">
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(clip.id);
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
                        onRemove(clip.id);
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
                            <div className="absolute left-0 top-0 bottom-0 w-20 bg-black/60 backdrop-blur-sm flex items-center px-2 text-[9px] text-gray-400 border-r border-white/5 z-20">
                                {prop.label}
                            </div>

                            <div
                                className="absolute left-20 right-0 top-0 bottom-0 cursor-crosshair"
                                onClick={(e) => onAddKeyframe(e, clip, prop.key, prop.defaultValue)}
                            >
                                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 group-hover/row:bg-white/20"></div>

                                {clip.keyframes?.[prop.key]?.map((kf, idx) => (
                                    <div
                                        key={idx}
                                        className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 hover:scale-150 transition-transform cursor-pointer z-30 shadow-sm shadow-black ${getKeyframeColor(kf.easing)}`}
                                        style={{ left: kf.frame * PIXELS_PER_FRAME }}
                                        onClick={(e) => onKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing)}
                                        onContextMenu={(e) => onKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing)}
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
                onMouseDown={(e) => onDragStart(e, clip, 'resize')}
            />
        </div>
    );
});
