/**
 * ZoomableTimeline - Enhanced timeline with pinch-to-zoom and frame-level precision
 *
 * Per Video Editing Improvement Plan Phase 2.1:
 * - Pinch-to-zoom timeline with frame-level precision
 * - Smooth scrolling and panning
 * - Visual zoom indicator
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomableTimelineProps {
    children: React.ReactNode;
    className?: string;
}

export function ZoomableTimeline({ children, className = '' }: ZoomableTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { timelineZoom, setTimelineZoom, project } = useVideoEditorStore();

    // Handle wheel zoom with Ctrl/Cmd
    const handleWheel = useCallback((e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setTimelineZoom(timelineZoom + delta);
        }
    }, [timelineZoom, setTimelineZoom]);

    // Handle pinch zoom on trackpad
    const handleGesture = useCallback((e: Event) => {
        const gestureEvent = e as unknown as { scale: number; preventDefault: () => void };
        gestureEvent.preventDefault();
        setTimelineZoom(timelineZoom * gestureEvent.scale);
    }, [timelineZoom, setTimelineZoom]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        // Safari gesture events for trackpad pinch
        container.addEventListener('gesturechange', handleGesture);

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('gesturechange', handleGesture);
        };
    }, [handleWheel, handleGesture]);

    const handleZoomIn = () => setTimelineZoom(Math.min(4, timelineZoom + 0.25));
    const handleZoomOut = () => setTimelineZoom(Math.max(0.25, timelineZoom - 0.25));
    const handleResetZoom = () => setTimelineZoom(1);

    // Calculate visible frames based on zoom
    const totalFrames = project.durationInFrames;
    const visibleFrames = Math.floor(totalFrames / timelineZoom);
    const frameWidth = timelineZoom * 2; // pixels per frame

    return (
        <div
            className={`relative flex flex-col ${className}`}
            role="region"
            aria-label="Timeline"
        >
            {/* Zoom Controls */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1 backdrop-blur-sm">
                <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Zoom Out (Ctrl -)"
                    aria-label="Zoom Out"
                    disabled={timelineZoom <= 0.25}
                >
                    <ZoomOut size={16} className={timelineZoom <= 0.25 ? 'opacity-50' : ''} />
                </button>

                <button
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 text-xs font-mono hover:bg-white/10 rounded transition-colors min-w-[48px]"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                >
                    {Math.round(timelineZoom * 100)}%
                </button>

                <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Zoom In (Ctrl +)"
                    aria-label="Zoom In"
                    disabled={timelineZoom >= 4}
                >
                    <ZoomIn size={16} className={timelineZoom >= 4 ? 'opacity-50' : ''} />
                </button>

                <div className="w-px h-4 bg-white/20 mx-1" />

                <button
                    onClick={handleResetZoom}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Fit to View"
                    aria-label="Fit to View"
                >
                    <Maximize2 size={16} />
                </button>
            </div>

            {/* Timeline Info */}
            <div
                className="absolute bottom-2 left-2 z-10 text-xs text-white/60 font-mono bg-black/30 px-2 py-1 rounded"
                aria-live="polite"
            >
                {visibleFrames} frames visible • {(project.durationInFrames / project.fps).toFixed(1)}s total
            </div>

            {/* Zoomable Content Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden"
                style={{
                    scrollBehavior: 'smooth',
                }}
                tabIndex={0}
                aria-label="Timeline Tracks"
            >
                <div
                    style={{
                        width: `${totalFrames * frameWidth}px`,
                        minWidth: '100%',
                        transform: `scaleX(${timelineZoom})`,
                        transformOrigin: 'left center',
                    }}
                >
                    {children}
                </div>
            </div>

            {/* Frame Ruler */}
            <FrameRuler
                totalFrames={totalFrames}
                fps={project.fps}
                zoom={timelineZoom}
                frameWidth={frameWidth}
            />
        </div>
    );
}

interface FrameRulerProps {
    totalFrames: number;
    fps: number;
    zoom: number;
    frameWidth: number;
}

const FrameRuler = React.memo(function FrameRuler({ totalFrames, fps, zoom, frameWidth }: FrameRulerProps) {
    // Calculate tick interval based on zoom level thresholds
    // This value only changes when zoom crosses specific thresholds
    const tickInterval = useMemo(() => {
        if (zoom >= 2) return fps / 4; // Show quarter-second marks
        if (zoom >= 1) return fps / 2; // Show half-second marks
        if (zoom >= 0.5) return fps; // Show second marks
        return fps * 2; // Show 2-second marks
    }, [zoom, fps]);

    // Derived values for CSS grid (Optimization: Use CSS for lines instead of DOM nodes)
    const unitPx = frameWidth * zoom;
    const majorInterval = fps;
    const minorInterval = tickInterval;

    const majorSpacing = majorInterval * unitPx;
    const minorSpacing = minorInterval * unitPx;

    // Use background gradients for ticks to reduce DOM node count by >90%
    const backgroundStyle = {
        backgroundImage: `
             linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px),
             linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px)
         `,
        backgroundSize: `
             ${majorSpacing}px 12px,
             ${minorSpacing}px 8px
         `,
        backgroundRepeat: 'repeat-x',
        backgroundPosition: '0 0'
    };

    // Generate labels only (significantly reducing iteration and object creation)
    const labels = useMemo(() => {
        const result: { frame: number; label: string }[] = [];
        // Determine label interval (labels appear on seconds, or every 2s if zoomed out)
        const step = Math.max(fps, tickInterval);

        for (let frame = 0; frame <= totalFrames; frame += step) {
            const seconds = frame / fps;
            result.push({ frame, label: formatTime(seconds) });
        }
        return result;
    }, [totalFrames, fps, tickInterval]);

    return (
        <div
            className="h-6 bg-black/30 border-t border-white/10 relative overflow-hidden"
            style={{ width: `${totalFrames * unitPx}px`, ...backgroundStyle }}
        >
            {labels.map(({ frame, label }) => (
                <div
                    key={frame}
                    className="absolute top-0 text-[10px] text-white/60 font-mono mt-3"
                    style={{ left: `${frame * unitPx}px`, transform: 'translateX(-50%)' }}
                >
                    {label}
                </div>
            ))}
        </div>
    );
});

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
}

export default ZoomableTimeline;
