import React, { memo, useMemo } from 'react';
import { generateTimeRulerMarks } from '../utils/timelineUtils';
import { PIXELS_PER_FRAME } from '../constants';

interface TimeRulerProps {
    durationInFrames: number;
    fps: number;
    onSeek: (frame: number) => void;
}

export const TimeRuler = memo(({ durationInFrames, fps, onSeek }: TimeRulerProps) => {
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

    return (
        <div
            className="h-6 w-full border-b border-gray-800 mb-2 relative cursor-pointer hover:bg-gray-900"
            style={{ minWidth: rulerWidth }}
            onClick={handleClick}
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
