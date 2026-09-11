import React, { memo } from 'react';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { PIXELS_PER_FRAME, TRACK_HEADER_WIDTH } from '../constants';

export interface PlayheadProps {
    trackHeaderOffset?: number;
    timelineZoom?: number;
}

export const Playhead = memo(({
    trackHeaderOffset = TRACK_HEADER_WIDTH,
    timelineZoom: propZoom,
}: PlayheadProps = {}) => {
    // Select only currentTime to prevent unnecessary re-renders when other parts of store change
    const currentTime = useVideoEditorStore(state => state.currentTime) ?? 0;
    const storeZoom = useVideoEditorStore(state => state.timelineZoom) ?? 1;
    const zoom = propZoom !== undefined ? propZoom : storeZoom;
    const pxPerFrame = PIXELS_PER_FRAME * zoom;

    const leftPosition = trackHeaderOffset + (currentTime * pxPerFrame);

    return (
        <div
            data-testid="timeline-playhead"
            className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
            style={{ left: leftPosition }}
        >
            <div
                data-testid="timeline-playhead-handle"
                className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"
            />
        </div>
    );
});

Playhead.displayName = 'Playhead';
