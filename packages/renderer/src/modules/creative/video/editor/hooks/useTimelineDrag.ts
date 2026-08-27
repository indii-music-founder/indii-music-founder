import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { throttle } from '@/lib/throttle';

const PIXELS_PER_FRAME = 2;
const SNAP_THRESHOLD_PX = 6;
const US_PER_SECOND = 1_000_000;

export type ClipDragType = 'move' | 'resize-left' | 'resize-right';

export interface ClipDragOrigin {
    startFrame: number;
    durationInFrames: number;
    sourceInUs?: number;
    sourceOutUs?: number;
}

export interface ClipDragContext {
    origin: ClipDragOrigin;
    deltaFrames: number;
    /** Snap candidates in frames: 0, project end, playhead, neighbors' edges. */
    candidates: number[];
    fps: number;
    pxPerFrame: number;
}

/** Snap a frame to the nearest candidate within the pixel threshold. */
export const snapFrame = (
    frame: number,
    candidates: number[],
    pxPerFrame: number,
    thresholdPx = SNAP_THRESHOLD_PX,
): number => {
    const thresholdFrames = thresholdPx / pxPerFrame;
    let best = frame;
    let bestDistance = thresholdFrames;
    for (const candidate of candidates) {
        const distance = Math.abs(candidate - frame);
        if (distance <= bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
};

/**
 * The move update: clamp at 0, then snap the clip's start edge to the
 * playhead, neighbors, or the project boundary.
 */
export const computeMoveUpdate = (ctx: ClipDragContext): { startFrame: number } => {
    const raw = Math.max(0, ctx.origin.startFrame + ctx.deltaFrames);
    return { startFrame: snapFrame(raw, ctx.candidates, ctx.pxPerFrame) };
};

/**
 * The trim update. Trims stay source-aware: when a clip carries µs trims,
 * the trimmed edge moves the source window with the visual edge so the
 * remaining footage is exactly what the user sees.
 */
export const computeTrimUpdate = (
    ctx: ClipDragContext,
    edge: 'resize-left' | 'resize-right',
): { startFrame?: number; durationInFrames: number; sourceInUs?: number; sourceOutUs?: number } => {
    const { origin } = ctx;
    const endFrame = origin.startFrame + origin.durationInFrames;
    const usPerFrame = US_PER_SECOND / ctx.fps;

    if (edge === 'resize-right') {
        const rawEnd = Math.max(origin.startFrame + 1, endFrame + ctx.deltaFrames);
        const snappedEnd = snapFrame(rawEnd, ctx.candidates, ctx.pxPerFrame);
        const durationInFrames = snappedEnd - origin.startFrame;
        const hasSourceRange = origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined;
        return {
            durationInFrames,
            ...(hasSourceRange ? { sourceOutUs: origin.sourceInUs! + durationInFrames * usPerFrame } : {}),
        };
    }

    const rawStart = Math.max(0, Math.min(endFrame - 1, origin.startFrame + ctx.deltaFrames));
    const snappedStart = snapFrame(rawStart, ctx.candidates, ctx.pxPerFrame);
    const durationInFrames = endFrame - snappedStart;
    const hasSourceRange = origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined;
    return {
        startFrame: snappedStart,
        durationInFrames,
        ...(hasSourceRange ? { sourceInUs: origin.sourceInUs! + (snappedStart - origin.startFrame) * usPerFrame } : {}),
    };
};

interface DragState {
    type: ClipDragType;
    clipId: string;
    startX: number;
    origin: ClipDragOrigin;
    candidates: number[];
    fps: number;
    pxPerFrame: number;
}

export function useTimelineDrag() {
    const updateClip = useVideoEditorStore(state => state.updateClip);
    const setSelectedClipId = useVideoEditorStore(state => state.setSelectedClipId);

    const [dragState, setDragState] = useState<DragState | null>(null);

    const dragStateRef = useRef(dragState);
    useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

    const updateClipRef = useRef(updateClip);
    useEffect(() => { updateClipRef.current = updateClip; }, [updateClip]);

    const handleDragStart = useCallback((e: React.MouseEvent, clip: VideoClip, type: ClipDragType) => {
        e.stopPropagation();
        e.preventDefault();
        const project = useVideoEditorStore.getState().project;
        const playhead = useVideoEditorStore.getState().currentTime;
        const zoom = useVideoEditorStore.getState().timelineZoom;
        const neighbors = project.clips
            .filter(c => c.id !== clip.id)
            .flatMap(c => [c.startFrame, c.startFrame + c.durationInFrames]);
        setDragState({
            type,
            clipId: clip.id,
            startX: e.clientX,
            origin: {
                startFrame: clip.startFrame,
                durationInFrames: clip.durationInFrames,
                sourceInUs: clip.sourceInUs,
                sourceOutUs: clip.sourceOutUs,
            },
            candidates: [0, project.durationInFrames, playhead, ...neighbors],
            fps: project.fps,
            pxPerFrame: PIXELS_PER_FRAME * zoom,
        });
        setSelectedClipId(clip.id);
    }, [setSelectedClipId]);

    useEffect(() => {
        const _moveCb = (e: MouseEvent) => {
            const current = dragStateRef.current;
            if (!current) return;

            const deltaFrames = Math.round((e.clientX - current.startX) / current.pxPerFrame);
            const ctx: ClipDragContext = {
                origin: current.origin,
                deltaFrames,
                candidates: current.candidates,
                fps: current.fps,
                pxPerFrame: current.pxPerFrame,
            };

            if (current.type === 'move') {
                updateClipRef.current(current.clipId, computeMoveUpdate(ctx));
            } else {
                updateClipRef.current(current.clipId, computeTrimUpdate(ctx, current.type));
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- throttle HoF requires any[] constraint
        const handleMouseMove = throttle(_moveCb as (...a: any[]) => any, 16);

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
