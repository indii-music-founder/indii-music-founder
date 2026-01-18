import React, { memo, useMemo } from 'react';
import { generateTimeRulerMarks } from '../utils/timelineUtils';
import { PIXELS_PER_FRAME } from '../constants';
import { useVideoEditorStore } from '../../store/videoEditorStore';

interface TimeRulerProps {
    durationInFrames: number;
    fps: number;
    onSeek: (frame: number) => void;
}

export const TimeRuler = memo(({ durationInFrames, fps, onSeek }: TimeRulerProps) => {
    // Select currentTime to update accessible value and support keyboard navigation
    const currentTime = useVideoEditorStore(state => state.currentTime);

    // Generate labels only (reducing iteration and object creation complexity is handled by utils)
    // We still generate marks for labels, but the drawing of ticks is offloaded to CSS
    const timeRulerMarks = useMemo(() => {
        return generateTimeRulerMarks(durationInFrames, fps);
    }, [durationInFrames, fps]);

    const rulerWidth = durationInFrames * PIXELS_PER_FRAME;

    // Optimization: CSS Gradient for ticks (1s intervals) to reduce DOM node count
    // 1 second = fps * PIXELS_PER_FRAME pixels
    const tickSpacing = fps * PIXELS_PER_FRAME;

    // We want a line every `tickSpacing` pixels.
    // background-image: linear-gradient(to right, border-color 1px, transparent 1px)
    // background-size: tickSpacing 100%

    const backgroundStyle: React.CSSProperties = {
        backgroundImage: `linear-gradient(to right, #1f2937 1px, transparent 1px)`,
        backgroundSize: `${tickSpacing}px 100%`,
        backgroundRepeat: 'repeat-x'
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const frame = Math.round(x / PIXELS_PER_FRAME);
        onSeek(Math.max(0, Math.min(frame, durationInFrames)));
    };

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

    return (
        <div
            className="h-6 w-full border-b border-gray-800 mb-2 relative cursor-pointer hover:bg-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            style={{ minWidth: rulerWidth }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={durationInFrames}
            aria-valuenow={currentTime}
            aria-valuetext={`${(currentTime / fps).toFixed(2)}s`}
        >
            {/* Ticks (CSS) - Replaces hundreds of div elements */}
            <div className="absolute inset-0 pointer-events-none" style={backgroundStyle} />

            {/* Labels (DOM) - Still needed for readability */}
            {timeRulerMarks.map((mark) => (
                <div key={mark.second} className="absolute top-0 text-[10px] text-gray-600 pl-1.5 pointer-events-none"
                    style={{ left: mark.position }}>
                    {mark.second}s
                </div>
            ))}
        </div>
    );
});

TimeRuler.displayName = 'TimeRuler';
