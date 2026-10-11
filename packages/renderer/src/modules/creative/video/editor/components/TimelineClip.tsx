import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { AudioWaveform } from './AudioWaveform';
import { NLETrackScrubCanvas } from './NLETrackScrubCanvas';
import { getKeyframeColor } from '../utils/keyframeUtils';
import { PIXELS_PER_FRAME, ANIMATABLE_PROPERTIES } from '../constants';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';
import { ClipDragType } from '../hooks/useTimelineDrag';

const XIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export interface TimelineClipProps {
    key?: React.Key;
    clip: VideoClip;
    isSelected: boolean;
    isExpanded: boolean;
    isLocked?: boolean;
    onToggleExpand: (id: string) => void;
    onRemove: (id: string) => void;
    onDragStart: (e: React.MouseEvent, clip: VideoClip, type: ClipDragType) => void;
    onAddKeyframe: (e: React.MouseEvent, clip: VideoClip, property: string, defaultValue: number) => void;
    onKeyframeClick: (e: React.MouseEvent, clipId: string, property: string, frame: number, easing?: string) => void;
    onMoveKeyframe?: (clipId: string, property: string, oldFrame: number, newFrame: number) => void;
}

export const TimelineClip = memo(({
    clip, isSelected, isExpanded, isLocked,
    onToggleExpand, onRemove, onDragStart,
    onAddKeyframe, onKeyframeClick, onMoveKeyframe
}: TimelineClipProps) => {
    const zoom = useVideoEditorStore(state => state.timelineZoom);
    const fps = useVideoEditorStore(state => state.project?.fps ?? 30);
    const activeTool = useVideoEditorStore(state => state.activeTool);
    const pxPerFrame = Math.max(0.1, PIXELS_PER_FRAME * (zoom || 1));
    const urlToResolve = clip.src && !clip.src.startsWith('file://') ? clip.src : null;
    const { url: resolvedUrl } = useResolvedStorageUrl(urlToResolve);
    const displayUrl = resolvedUrl || clip.src;

    const clipContainerRef = useRef<HTMLDivElement>(null);
    const [hoverCutFrame, setHoverCutFrame] = useState<number | null>(null);

    const handlePointerMoveClip = useCallback((e: React.PointerEvent) => {
        if (activeTool !== 'razor' || isLocked) {
            if (hoverCutFrame !== null) setHoverCutFrame(null);
            return;
        }
        const rect = clipContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const localX = e.clientX - rect.left;
        const frameOffset = Math.round(localX / pxPerFrame);
        const targetFrame = clip.startFrame + frameOffset;
        if (targetFrame > clip.startFrame && targetFrame < clip.startFrame + clip.durationInFrames) {
            setHoverCutFrame(targetFrame);
        } else {
            setHoverCutFrame(null);
        }
    }, [activeTool, isLocked, pxPerFrame, clip.startFrame, clip.durationInFrames, hoverCutFrame]);

    const handlePointerLeaveClip = useCallback(() => {
        if (hoverCutFrame !== null) setHoverCutFrame(null);
    }, [hoverCutFrame]);

    const handleClipPointerDown = useCallback((e: React.PointerEvent) => {
        if (isLocked) return;
        if (activeTool === 'razor') {
            e.stopPropagation();
            e.preventDefault();
            const rect = clipContainerRef.current?.getBoundingClientRect();
            let targetFrame = hoverCutFrame;
            if (targetFrame === null && rect) {
                const localX = e.clientX - rect.left;
                const frameOffset = Math.round(localX / pxPerFrame);
                targetFrame = clip.startFrame + frameOffset;
            }
            if (targetFrame !== null && targetFrame > clip.startFrame && targetFrame < clip.startFrame + clip.durationInFrames) {
                useVideoEditorStore.getState().splitClip(clip.id, targetFrame);
                setHoverCutFrame(null);
            }
            return;
        }
        if (activeTool === 'slip') {
            onDragStart(e as unknown as React.MouseEvent, clip, 'slip');
            return;
        }
        onDragStart(e as unknown as React.MouseEvent, clip, 'move');
    }, [activeTool, clip, hoverCutFrame, isLocked, onDragStart, pxPerFrame]);

    // Feature 22: Keyframe dragging state and refs
    const [draggingKeyframe, setDraggingKeyframe] = useState<{
        propKey: string;
        startFrame: number;
        currentFrame: number;
    } | null>(null);

    const justDraggedRef = useRef(false);
    const activeCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            if (activeCleanupRef.current) {
                activeCleanupRef.current();
            }
        };
    }, []);

    const handleKeyframePointerDown = useCallback((
        e: React.PointerEvent,
        propKey: string,
        startFrame: number
    ) => {
        // Prevent event bubbling to the clip body (which would drag the entire clip)
        e.stopPropagation();
        if (isLocked) return;

        const startX = e.clientX;
        let hasMoved = false;
        let newFrame = startFrame;

        const cleanup = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handleCancel);
            window.removeEventListener('keydown', handleKeyDown);
            activeCleanupRef.current = null;
        };
        activeCleanupRef.current = cleanup;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            if (Math.abs(deltaX) >= 3) {
                hasMoved = true;
            }
            const deltaFrames = Math.round(deltaX / pxPerFrame);
            newFrame = Math.max(0, Math.min(clip.durationInFrames, startFrame + deltaFrames));

            setDraggingKeyframe({
                propKey,
                startFrame,
                currentFrame: newFrame,
            });
        };

        const handlePointerUp = () => {
            cleanup();
            setDraggingKeyframe(null);

            if (hasMoved) {
                justDraggedRef.current = true;
                if (newFrame !== startFrame) {
                    if (onMoveKeyframe) {
                        onMoveKeyframe(clip.id, propKey, startFrame, newFrame);
                    } else {
                        useVideoEditorStore.getState().moveKeyframe(clip.id, propKey, startFrame, newFrame);
                    }
                }
            }
        };

        // Pen palm rejection or touch interruption: restore, never move.
        const handleCancel = () => {
            cleanup();
            setDraggingKeyframe(null);
        };

        const handleKeyDown = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === 'Escape') {
                cleanup();
                setDraggingKeyframe(null);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handleCancel);
        window.addEventListener('keydown', handleKeyDown);
    }, [clip.id, clip.durationInFrames, isLocked, onMoveKeyframe, pxPerFrame]);

    const cursorClass = isLocked
        ? 'cursor-default'
        : activeTool === 'razor'
        ? 'cursor-crosshair'
        : activeTool === 'slip'
        ? 'cursor-ew-resize'
        : 'cursor-pointer';

    return (
        <div
            ref={clipContainerRef}
            className={`absolute top-2 border rounded transition-all group/clip ${cursorClass} ${isSelected ? 'bg-green-600 border-green-400 ring-1 ring-white' : 'bg-green-600/30 border-green-500/50 hover:bg-green-600/50'} ${isLocked ? 'pointer-events-none select-none opacity-80' : ''}`}
            style={{
                left: clip.startFrame * pxPerFrame,
                width: clip.durationInFrames * pxPerFrame,
                height: isExpanded ? 'auto' : '64px',
                zIndex: isExpanded ? 20 : 10
            }}
            onPointerDown={handleClipPointerDown}
            onPointerMove={handlePointerMoveClip}
            onPointerLeave={handlePointerLeaveClip}
        >
            {/* Clip Content */}
            <div className="px-2 py-1 flex items-center justify-between h-8 overflow-hidden pointer-events-none relative z-10">
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(clip.id);
                        }}
                        data-testid={`clip-expand-${clip.id}`}
                        className="pointer-events-auto p-0.5 hover:bg-black/20 rounded text-white/70 hover:text-white"
                        aria-label={isExpanded ? "Collapse clip details" : "Expand clip details"}
                        aria-expanded={isExpanded}
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
                    data-testid={`clip-remove-${clip.id}`}
                    className="opacity-0 group-hover/clip:opacity-100 text-green-200 hover:text-white transition-opacity pointer-events-auto"
                    aria-label={`Remove clip ${clip.name}`}
                >
                    <XIcon size={12} />
                </button>
            </div>

            {/* Audio Waveform */}
            {clip.type === 'audio' && displayUrl && (
                <div className="absolute top-0 left-0 right-0 h-16 z-0 opacity-50 pointer-events-none">
                    <AudioWaveform
                        src={displayUrl}
                        width={clip.durationInFrames * pxPerFrame}
                        height={64}
                        color="rgba(255, 255, 255, 0.6)"
                        sourceInUs={clip.sourceInUs}
                        sourceOutUs={clip.sourceOutUs}
                        durationInFrames={clip.durationInFrames}
                        fps={fps}
                    />
                </div>
            )}

            {/* Video/Image Preview Thumbnail */}
            {(clip.type === 'video' || clip.type === 'image') && displayUrl && (
                <div className="absolute inset-0 z-0 opacity-70 pointer-events-none overflow-hidden rounded bg-black/50">
                    {clip.type === 'video' ? (
                        <NLETrackScrubCanvas
                            src={displayUrl}
                            width={clip.durationInFrames * pxPerFrame}
                            height={64}
                            durationInFrames={clip.durationInFrames}
                            fps={fps}
                            sourceInUs={clip.sourceInUs}
                            sourceOutUs={clip.sourceOutUs}
                        />
                    ) : (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="" />
                    )}
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

                                {clip.keyframes?.[prop.key]?.map((kf) => {
                                    const isDraggingThis = draggingKeyframe?.propKey === prop.key && draggingKeyframe?.startFrame === kf.frame;
                                    const currentDisplayFrame = isDraggingThis ? draggingKeyframe.currentFrame : kf.frame;

                                    return (
                                        <div
                                            key={`${prop.key}-${kf.frame}`}
                                            data-testid={`keyframe-diamond-${clip.id}-${prop.key}-${kf.frame}`}
                                            className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 transition-transform z-30 shadow-sm shadow-black cursor-grab active:cursor-grabbing ${
                                                isDraggingThis ? 'scale-150 ring-2 ring-white cursor-grabbing' : 'hover:scale-150'
                                            } ${getKeyframeColor(kf.easing)}`}
                                            style={{ left: currentDisplayFrame * pxPerFrame }}
                                            onPointerDown={(e) => handleKeyframePointerDown(e, prop.key, kf.frame)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (justDraggedRef.current) {
                                                    justDraggedRef.current = false;
                                                    return;
                                                }
                                                onKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing);
                                            }}
                                            onContextMenu={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                onKeyframeClick(e, clip.id, prop.key, kf.frame, kf.easing);
                                            }}
                                            title={`${prop.label}: ${kf.value} @ f${currentDisplayFrame} (${kf.easing || 'linear'})`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Razor Cutline Visual Indicator (Active during Razor Tool) */}
            {activeTool === 'razor' && hoverCutFrame !== null && (
                <div
                    data-testid={`razor-cutline-${clip.id}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] z-30 pointer-events-none"
                    style={{ left: (hoverCutFrame - clip.startFrame) * pxPerFrame }}
                >
                    <div
                        data-testid={`razor-cut-badge-${clip.id}`}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-mono font-bold px-1 py-0.5 rounded shadow whitespace-nowrap z-40 pointer-events-none flex items-center gap-0.5"
                    >
                        <span>✂</span>
                        <span>f{hoverCutFrame}</span>
                    </div>
                </div>
            )}

            {/* Trim handles: both edges, source-aware (supports ripple and standard trim) */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-2 transition-colors z-20 ${
                    activeTool === 'ripple'
                        ? 'cursor-col-resize bg-amber-400/40 hover:bg-amber-300 ring-1 ring-amber-400/80'
                        : 'cursor-w-resize hover:bg-white/50'
                }`}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, clip, activeTool === 'ripple' ? 'ripple-left' : 'resize-left');
                }}
                data-testid={`clip-trim-left-${clip.id}`}
                title={activeTool === 'ripple' ? 'Ripple Trim Head' : 'Trim In'}
            />
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 transition-colors z-20 ${
                    activeTool === 'ripple'
                        ? 'cursor-col-resize bg-amber-400/40 hover:bg-amber-300 ring-1 ring-amber-400/80'
                        : 'cursor-e-resize hover:bg-white/50'
                }`}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, clip, activeTool === 'ripple' ? 'ripple-right' : 'resize-right');
                }}
                data-testid={`clip-trim-right-${clip.id}`}
                title={activeTool === 'ripple' ? 'Ripple Trim Tail' : 'Trim Out'}
            />
        </div>
    );
});
