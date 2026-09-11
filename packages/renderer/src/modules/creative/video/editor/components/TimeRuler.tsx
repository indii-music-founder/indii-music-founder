import React, { memo, useMemo, useRef, useCallback, useEffect } from 'react';
import { generateTimeRulerMarks } from '../utils/timelineUtils';
import { PIXELS_PER_FRAME, TRACK_HEADER_WIDTH } from '../constants';
import { useVideoEditorStore } from '../../store/videoEditorStore';

interface TimeRulerProps {
    durationInFrames: number;
    fps: number;
    onSeek: (frame: number) => void;
    trackHeaderOffset?: number;
    loopRegion?: { a: number; b: number } | null;
}

export const TimeRuler = memo(({
    durationInFrames,
    fps,
    onSeek,
    trackHeaderOffset = TRACK_HEADER_WIDTH,
    loopRegion: propLoopRegion,
}: TimeRulerProps) => {
    // Select currentTime to update accessible value and support keyboard navigation
    const currentTime = useVideoEditorStore(state => state.currentTime) ?? 0;
    const zoom = useVideoEditorStore(state => state.timelineZoom) ?? 1;
    const storeLoopRegion = useVideoEditorStore(state => state.loopRegion);
    const loopRegion = propLoopRegion !== undefined ? propLoopRegion : storeLoopRegion;

    const pxPerFrame = PIXELS_PER_FRAME * zoom;
    const rulerTrackRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    // Generate labels only (reducing iteration and object creation complexity is handled by utils)
    // We still generate marks for labels, but the drawing of ticks is offloaded to CSS
    const timeRulerMarks = useMemo(() => {
        return generateTimeRulerMarks(durationInFrames, fps);
    }, [durationInFrames, fps]);

    const rulerWidth = durationInFrames * pxPerFrame;

    // Optimization: CSS Gradient for ticks (1s intervals) to reduce DOM node count
    // 1 second = fps * pxPerFrame pixels
    const tickSpacing = fps * pxPerFrame;

    const backgroundStyle: React.CSSProperties = {
        backgroundImage: `linear-gradient(to right, #1f2937 1px, transparent 1px)`,
        backgroundSize: `${tickSpacing}px 100%`,
        backgroundRepeat: 'repeat-x'
    };

    const getClientXFromEvent = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
        if (typeof e.clientX === 'number' && Number.isFinite(e.clientX)) return e.clientX;
        const native = e.nativeEvent as MouseEvent;
        if (native && typeof native.clientX === 'number' && Number.isFinite(native.clientX)) return native.clientX;
        return 0;
    };

    const getPointerIdFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
        if (typeof e.pointerId === 'number') return e.pointerId;
        const native = e.nativeEvent as unknown as { pointerId?: number };
        if (native && typeof native.pointerId === 'number') return native.pointerId;
        return 0;
    };

    const getFrameFromClientX = useCallback((clientX: number) => {
        const rulerEl = rulerTrackRef.current;
        if (!rulerEl) return 0;
        const rect = rulerEl.getBoundingClientRect();
        // In jsdom without layout simulation, rect.left and rect.width might both be 0 while trackHeaderOffset > 0
        const trackLeft = rect.left !== 0 ? rect.left : (rect.width === 0 && trackHeaderOffset > 0 ? trackHeaderOffset : 0);
        const safeX = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
        const x = safeX - trackLeft;
        const safePx = typeof pxPerFrame === 'number' && pxPerFrame > 0 ? pxPerFrame : 2;
        const frame = Math.round(x / safePx);
        if (!Number.isFinite(frame)) return 0;
        return Math.max(0, Math.min(frame, durationInFrames));
    }, [durationInFrames, pxPerFrame, trackHeaderOffset]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const frame = getFrameFromClientX(getClientXFromEvent(e));
        onSeek(frame);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== undefined && e.button !== 0) return;
        isDraggingRef.current = true;
        const pointerId = getPointerIdFromEvent(e);
        try {
            (e.currentTarget as HTMLElement).setPointerCapture?.(pointerId);
        } catch {
            // Ignore capture failure in test/unsupported environments
        }
        const frame = getFrameFromClientX(getClientXFromEvent(e));
        onSeek(frame);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const frame = getFrameFromClientX(getClientXFromEvent(e));
        onSeek(frame);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const pointerId = getPointerIdFromEvent(e);
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerId);
        } catch {
            // Ignore release failure
        }
        const frame = getFrameFromClientX(getClientXFromEvent(e));
        onSeek(frame);
    };


    useEffect(() => {
        const handleWindowPointerUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
            }
        };
        window.addEventListener('pointerup', handleWindowPointerUp);
        return () => window.removeEventListener('pointerup', handleWindowPointerUp);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        let newTime = currentTime;
        const frameStep = 1;
        const largeStep = fps; // 1 second

        switch (e.key) {
            case 'ArrowLeft':
                newTime = Math.max(0, currentTime - (e.shiftKey ? largeStep : frameStep));
                e.preventDefault();
                break;
            case 'ArrowRight':
                newTime = Math.min(durationInFrames, currentTime + (e.shiftKey ? largeStep : frameStep));
                e.preventDefault();
                break;
            case 'Home':
                newTime = 0;
                e.preventDefault();
                break;
            case 'End':
                newTime = durationInFrames;
                e.preventDefault();
                break;
            default:
                return;
        }

        if (newTime !== currentTime) {
            onSeek(newTime);
        }
    };

    // Calculate loop overlay geometry
    const loopOverlay = useMemo(() => {
        if (!loopRegion) return null;
        const loopStart = Math.max(0, Math.min(loopRegion.a, durationInFrames));
        const loopEnd = Math.max(loopStart, Math.min(loopRegion.b, durationInFrames));
        const left = loopStart * pxPerFrame;
        const width = Math.max(0, (loopEnd - loopStart) * pxPerFrame);
        return { left, width, a: loopStart, b: loopEnd };
    }, [loopRegion, durationInFrames, pxPerFrame]);

    return (
        <div
            className="h-6 w-full border-b border-gray-800 mb-2 flex relative select-none cursor-pointer hover:bg-gray-900/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            style={{ minWidth: rulerWidth + (trackHeaderOffset || 0) }}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={durationInFrames}
            aria-valuenow={currentTime}
            aria-valuetext={`${(currentTime / fps).toFixed(2)}s`}
        >
            {/* 192px Track Header Offset Spacer */}
            {trackHeaderOffset > 0 && (
                <div
                    data-testid="time-ruler-spacer"
                    className="shrink-0 border-r border-gray-800/80 bg-gray-900/40 pointer-events-none"
                    style={{ width: trackHeaderOffset }}
                />
            )}

            {/* Ruler Track Area */}
            <div ref={rulerTrackRef} className="relative flex-1 h-full" style={{ minWidth: rulerWidth }}>
                {/* Ticks (CSS) */}
                <div className="absolute inset-0 pointer-events-none" style={backgroundStyle} />

                {/* Loop Region Overlay & Handles */}
                {loopOverlay && (
                    <div
                        data-testid="loop-region-overlay"
                        className="absolute top-0 bottom-0 bg-blue-500/20 border-l-2 border-r-2 border-blue-400 pointer-events-none z-10"
                        style={{ left: loopOverlay.left, width: loopOverlay.width }}
                    >
                        <div
                            data-testid="loop-in-marker"
                            className="absolute top-0 left-0 bg-blue-500 text-white text-[9px] font-bold px-1 rounded-br pointer-events-none leading-none py-0.5"
                            title={`Loop In: frame ${loopOverlay.a}`}
                        >
                            ⟦
                        </div>
                        <div
                            data-testid="loop-out-marker"
                            className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-bold px-1 rounded-bl pointer-events-none leading-none py-0.5"
                            title={`Loop Out: frame ${loopOverlay.b}`}
                        >
                            ⟧
                        </div>
                    </div>
                )}

                {/* Labels */}
                {timeRulerMarks.map((mark) => (
                    <div
                        key={mark.second}
                        className="absolute top-0 text-[10px] text-gray-600 pl-1.5 pointer-events-none"
                        style={{ left: mark.position * zoom }}
                    >
                        {mark.second}s
                    </div>
                ))}
            </div>
        </div>
    );
});

TimeRuler.displayName = 'TimeRuler';
