import React, { memo } from 'react';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { PIXELS_PER_FRAME } from '../constants';

export const Playhead = memo(() => {
    // Select only currentTime to prevent unnecessary re-renders when other parts of store change
    const currentTime = useVideoEditorStore(state => state.currentTime);

    return (
        <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
            style={{ left: (currentTime * PIXELS_PER_FRAME) + 8 }}
        >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"></div>
        </div>
    );
});

Playhead.displayName = 'Playhead';
