import React, { memo, useMemo } from 'react';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { formatTimecode } from '../utils/timelineUtils';

export interface TimelineTimecodeProps {
    className?: string;
    showHours?: boolean;
    currentTime?: number;
    fps?: number;
}


/**
 * Self-subscribing timecode component that updates dynamically with playhead progression
 * without triggering re-renders of parent timeline components or track trees.
 */
export const TimelineTimecode = memo(({
    className,
    showHours = false,
    currentTime: propTime,
    fps: propFps,
}: TimelineTimecodeProps) => {
    const storeTime = useVideoEditorStore(state => state.currentTime) ?? 0;
    const storeFps = useVideoEditorStore(state => state.project?.fps) || 30;

    const time = propTime !== undefined ? propTime : storeTime;
    const fps = propFps !== undefined ? propFps : storeFps;

    const formattedTimecode = useMemo(() => {
        return formatTimecode(time, fps, showHours);
    }, [time, fps, showHours]);

    return (
        <span
            data-testid="timeline-timecode"
            className={className || "text-[10px] text-[--primary] font-mono font-bold"}
        >
            {formattedTimecode}
        </span>
    );
});

TimelineTimecode.displayName = 'TimelineTimecode';
