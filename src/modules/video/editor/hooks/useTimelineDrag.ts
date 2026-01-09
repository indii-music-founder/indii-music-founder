import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { throttle } from '@/lib/throttle';

const PIXELS_PER_FRAME = 2;

export function useTimelineDrag() {
    const updateClip = useVideoEditorStore(state => state.updateClip);
    const setSelectedClipId = useVideoEditorStore(state => state.setSelectedClipId);

    const [dragState, setDragState] = useState<{
        type: 'move' | 'resize';
        clipId: string;
        startX: number;
        originalStartFrame: number;
        originalDuration: number;
    } | null>(null);

    // Refs for event handlers
    const dragStateRef = useRef(dragState);
    useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

    const updateClipRef = useRef(updateClip);
    useEffect(() => { updateClipRef.current = updateClip; }, [updateClip]);

    const handleDragStart = useCallback((e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => {
        e.stopPropagation();
        setDragState({
            type,
            clipId: clip.id,
            startX: e.clientX,
            originalStartFrame: clip.startFrame,
            originalDuration: clip.durationInFrames
        });
        setSelectedClipId(clip.id);
    }, [setSelectedClipId]);

    useEffect(() => {
        const handleMouseMove = throttle((e: MouseEvent) => {
            if (!dragStateRef.current) return;

            const currentDragState = dragStateRef.current;
            const deltaPixels = e.clientX - currentDragState.startX;
            const deltaFrames = Math.round(deltaPixels / PIXELS_PER_FRAME);

            if (currentDragState.type === 'move') {
                const newStartFrame = Math.max(0, currentDragState.originalStartFrame + deltaFrames);
                updateClipRef.current(currentDragState.clipId, { startFrame: newStartFrame });
            } else if (currentDragState.type === 'resize') {
                const newDuration = Math.max(1, currentDragState.originalDuration + deltaFrames);
                updateClipRef.current(currentDragState.clipId, { durationInFrames: newDuration });
            }
        }, 16);

        const handleMouseUp = () => {
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return {
        dragState,
        handleDragStart
    };
}
