/* eslint-disable react-hooks/refs */
import { useRef, useMemo, useEffect } from 'react';
import { VideoClip } from '../../store/videoEditorStore';
import { groupClipsByTrack } from '../utils/timelineUtils';

/**
 * A hook that groups clips by track ID but maintains referential stability of the arrays
 * for tracks that haven't changed. This prevents unnecessary re-renders of TimelineTrack components.
 */
export const useStableGroupedClips = (clips: VideoClip[]): Record<string, VideoClip[]> => {
    // Keep track of the previous result to reuse stable arrays
    const prevGroupedRef = useRef<Record<string, VideoClip[]>>({});

    const result = useMemo(() => {
        const nextGrouped = groupClipsByTrack(clips);
        // eslint-disable-next-line react-hooks/refs
        const prevGrouped = prevGroupedRef.current;
        const result: Record<string, VideoClip[]> = {};

        // Get all unique track IDs from nextGrouped (we only care about current tracks)
        const trackIds = Object.keys(nextGrouped);
        let hasChanges = false;

        for (const trackId of trackIds) {
            const nextClips = nextGrouped[trackId] || [];
            const prevClips = prevGrouped[trackId]; // May be undefined if track is new

            // If track is new or length changed, it's definitely different
            if (!prevClips || nextClips.length !== prevClips.length) {
                result[trackId] = nextClips;
                hasChanges = true;
                continue;
            }

            // Check referential equality of items
            // We assume that if a clip is modified, its object reference changes in the store (Zustand/Redux pattern).
            let isSame = true;
            for (let i = 0; i < nextClips.length; i++) {
                if (nextClips[i] !== prevClips[i]) {
                    isSame = false;
                    break;
                }
            }

            if (isSame) {
                result[trackId] = prevClips; // Reuse old array reference
            } else {
                result[trackId] = nextClips;
                hasChanges = true;
            }
        }

        return result;

    }, [clips]);

    useEffect(() => {
        prevGroupedRef.current = result;
    }, [result]);

    return result;
};
