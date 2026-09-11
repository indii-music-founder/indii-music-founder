import { useState, useRef, useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { throttle } from '@/lib/throttle';
import { isClipCompatibleWithTrack } from '../utils/timelineUtils';

const PIXELS_PER_FRAME = 2;
const SNAP_THRESHOLD_PX = 6;
const US_PER_SECOND = 1_000_000;

export type ClipDragType = 'move' | 'resize-left' | 'resize-right';

export interface ClipDragOrigin {
    startFrame: number;
    durationInFrames: number;
    trackId?: string;
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
    targetTrackId?: string;
}

export interface SnapResult {
    snappedFrame: number;
    didSnap: boolean;
    snapTarget?: number;
    distancePx: number;
}

export interface MoveUpdate {
    startFrame: number;
    trackId?: string;
    snapIndicatorFrame?: number | null;
}

export interface TrimUpdate {
    startFrame?: number;
    durationInFrames: number;
    sourceInUs?: number;
    sourceOutUs?: number;
    snapIndicatorFrame?: number | null;
}

/** Global snap indicator store allowing timeline indicators to synchronize seamlessly with active drags. */
interface SnapIndicatorStore {
    snapIndicatorFrame: number | null;
    setSnapIndicatorFrame: (frame: number | null) => void;
}

export const useSnapIndicatorStore = create<SnapIndicatorStore>((set) => ({
    snapIndicatorFrame: null,
    setSnapIndicatorFrame: (frame) => set({ snapIndicatorFrame: frame }),
}));

/** Snap a frame to the nearest candidate within the pixel threshold, returning detailed snap metadata. */
export const snapFrame = (
    frame: number,
    candidates: number[],
    pxPerFrame: number,
    thresholdPx = SNAP_THRESHOLD_PX,
): SnapResult => {
    const thresholdFrames = thresholdPx / pxPerFrame;
    let best = frame;
    let bestDistanceFrames = thresholdFrames;
    let didSnap = false;
    let snapTarget: number | undefined = undefined;
    let minDistancePx = Infinity;

    for (const candidate of candidates) {
        const distFrames = Math.abs(candidate - frame);
        const distPx = distFrames * pxPerFrame;
        if (distPx < minDistancePx) {
            minDistancePx = distPx;
        }
        if (distFrames <= bestDistanceFrames) {
            best = candidate;
            bestDistanceFrames = distFrames;
            didSnap = true;
            snapTarget = candidate;
        }
    }

    return {
        snappedFrame: best,
        didSnap,
        snapTarget,
        distancePx: didSnap ? bestDistanceFrames * pxPerFrame : minDistancePx,
    };
};

/**
 * The move update: evaluates dual-edge magnetic snapping (leading edge startFrame
 * and trailing edge endFrame) against snap candidates, choosing the closest snap target,
 * and handles multi-track movement if targetTrackId is provided.
 */
export const computeMoveUpdate = (ctx: ClipDragContext): MoveUpdate => {
    const rawStart = Math.max(0, ctx.origin.startFrame + ctx.deltaFrames);
    const snapStart = snapFrame(rawStart, ctx.candidates, ctx.pxPerFrame);

    const rawEnd = rawStart + ctx.origin.durationInFrames;
    const snapEnd = snapFrame(rawEnd, ctx.candidates, ctx.pxPerFrame);

    let startFrame: number;
    let snapIndicatorFrame: number | null = null;

    if (snapEnd.didSnap && (!snapStart.didSnap || snapEnd.distancePx < snapStart.distancePx)) {
        // Trailing edge snapped closer to a candidate
        startFrame = Math.max(0, snapEnd.snappedFrame - ctx.origin.durationInFrames);
        snapIndicatorFrame = snapEnd.snapTarget ?? null;
    } else if (snapStart.didSnap) {
        // Leading edge snapped closer to a candidate
        startFrame = snapStart.snappedFrame;
        snapIndicatorFrame = snapStart.snapTarget ?? null;
    } else {
        // Neither edge snapped
        startFrame = rawStart;
        snapIndicatorFrame = null;
    }

    const trackUpdate = (ctx.targetTrackId && ctx.targetTrackId !== ctx.origin.trackId)
        ? { trackId: ctx.targetTrackId }
        : {};

    return {
        startFrame,
        snapIndicatorFrame,
        ...trackUpdate,
    };
};

/**
 * The trim update: provides boundary protection to enforce durationInFrames >= 1,
 * prevents inverted/negative durations, clamps sourceInUs >= 0 and within sourceOutUs,
 * and emits snapIndicatorFrame for visual alignment guides during edge trimming.
 */
export const computeTrimUpdate = (
    ctx: ClipDragContext,
    edge: 'resize-left' | 'resize-right',
): TrimUpdate => {
    const { origin } = ctx;
    const endFrame = origin.startFrame + origin.durationInFrames;
    const usPerFrame = US_PER_SECOND / ctx.fps;

    if (edge === 'resize-right') {
        const rawEnd = Math.max(origin.startFrame + 1, endFrame + ctx.deltaFrames);
        const snap = snapFrame(rawEnd, ctx.candidates, ctx.pxPerFrame);
        // Boundary protection: duration must be at least 1 frame
        const durationInFrames = Math.max(1, snap.snappedFrame - origin.startFrame);
        const hasSourceRange = origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined;
        let newSourceOutUs: number | undefined;
        if (hasSourceRange) {
            const calculatedSourceOut = origin.sourceInUs! + durationInFrames * usPerFrame;
            newSourceOutUs = Math.max(origin.sourceInUs! + 1, calculatedSourceOut);
        }
        return {
            durationInFrames,
            ...(newSourceOutUs !== undefined ? { sourceOutUs: newSourceOutUs } : {}),
            snapIndicatorFrame: snap.didSnap ? (snap.snapTarget ?? null) : null,
        };
    }

    // resize-left: trim in-point
    const rawStart = Math.max(0, Math.min(endFrame - 1, origin.startFrame + ctx.deltaFrames));
    const snap = snapFrame(rawStart, ctx.candidates, ctx.pxPerFrame);
    // Boundary protection: snappedStart cannot exceed endFrame - 1 or fall below 0
    const snappedStart = Math.max(0, Math.min(endFrame - 1, snap.snappedFrame));
    const durationInFrames = Math.max(1, endFrame - snappedStart);
    const hasSourceRange = origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined;
    let newSourceInUs: number | undefined;
    if (hasSourceRange) {
        const calculatedSourceIn = origin.sourceInUs! + (snappedStart - origin.startFrame) * usPerFrame;
        // Never let sourceInUs become negative, and ensure it stays below sourceOutUs
        newSourceInUs = Math.max(0, Math.min(origin.sourceOutUs! - 1, calculatedSourceIn));
    }
    return {
        startFrame: snappedStart,
        durationInFrames,
        ...(newSourceInUs !== undefined ? { sourceInUs: newSourceInUs } : {}),
        snapIndicatorFrame: snap.didSnap ? (snap.snapTarget ?? null) : null,
    };
};

/** Detects the target trackId under the cursor point (clientX, clientY). */
export const findTrackAtPoint = (clientX: number, clientY: number): string | null => {
    if (typeof document === 'undefined') return null;

    if (typeof document.elementFromPoint === 'function') {
        const el = document.elementFromPoint(clientX, clientY);
        const trackEl = el?.closest?.('[data-track-id]');
        if (trackEl) {
            const trackId = trackEl.getAttribute('data-track-id');
            if (trackId) return trackId;
        }
    }

    if (typeof document.querySelectorAll === 'function') {
        const trackElements = document.querySelectorAll('[data-track-id]');
        for (let i = 0; i < trackElements.length; i++) {
            const trackElem = trackElements[i] as HTMLElement;
            if (typeof trackElem.getBoundingClientRect === 'function') {
                const rect = trackElem.getBoundingClientRect();
                if (rect && rect.height > 0) {
                    if (clientY >= rect.top && clientY <= rect.bottom) {
                        const trackId = trackElem.getAttribute('data-track-id');
                        if (trackId) return trackId;
                    }
                }
            }
        }
    }

    return null;
};

interface DragState {
    type: ClipDragType;
    clipId: string;
    clipType: string;
    originTrackId: string;
    currentTrackId: string;
    startX: number;
    startY: number;
    origin: ClipDragOrigin;
    candidates: number[];
    fps: number;
    pxPerFrame: number;
}

export function useTimelineDrag() {
    const updateClipTransient = useVideoEditorStore(state => state.updateClipTransient);
    const commitTransientClipUpdate = useVideoEditorStore(state => state.commitTransientClipUpdate);
    const abortTransientClipUpdate = useVideoEditorStore(state => state.abortTransientClipUpdate);
    const setSelectedClipId = useVideoEditorStore(state => state.setSelectedClipId);

    const [dragState, setDragState] = useState<DragState | null>(null);
    const [snapIndicatorFrame, setSnapIndicatorFrame] = useState<number | null>(null);

    const dragStateRef = useRef(dragState);
    useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

    const updateClipTransientRef = useRef(updateClipTransient);
    useEffect(() => { updateClipTransientRef.current = updateClipTransient; }, [updateClipTransient]);

    const commitTransientClipUpdateRef = useRef(commitTransientClipUpdate);
    useEffect(() => { commitTransientClipUpdateRef.current = commitTransientClipUpdate; }, [commitTransientClipUpdate]);

    const abortTransientClipUpdateRef = useRef(abortTransientClipUpdate);
    useEffect(() => { abortTransientClipUpdateRef.current = abortTransientClipUpdate; }, [abortTransientClipUpdate]);

    const handleDragStart = useCallback((e: React.MouseEvent, clip: VideoClip, type: ClipDragType) => {
        e.stopPropagation();
        e.preventDefault();
        abortTransientClipUpdateRef.current();
        const project = useVideoEditorStore.getState().project;
        const playhead = useVideoEditorStore.getState().currentTime;
        const zoom = useVideoEditorStore.getState().timelineZoom;
        const neighbors = project.clips
            .filter(c => c.id !== clip.id)
            .flatMap(c => [c.startFrame, c.startFrame + c.durationInFrames]);
        const clipTrackId = clip.trackId;
        setDragState({
            type,
            clipId: clip.id,
            clipType: clip.type,
            originTrackId: clipTrackId,
            currentTrackId: clipTrackId,
            startX: e.clientX,
            startY: e.clientY,
            origin: {
                startFrame: clip.startFrame,
                durationInFrames: clip.durationInFrames,
                trackId: clipTrackId,
                sourceInUs: clip.sourceInUs,
                sourceOutUs: clip.sourceOutUs,
            },
            candidates: [0, project.durationInFrames, playhead, ...neighbors],
            fps: project.fps,
            pxPerFrame: PIXELS_PER_FRAME * zoom,
        });
        setSelectedClipId(clip.id);
        setSnapIndicatorFrame(null);
        useSnapIndicatorStore.getState().setSnapIndicatorFrame(null);
    }, [setSelectedClipId]);

    useEffect(() => {
        const _moveCb = (e: MouseEvent) => {
            const current = dragStateRef.current;
            if (!current) return;

            let targetTrackId = current.currentTrackId;
            if (current.type === 'move') {
                const detectedTrackId = findTrackAtPoint(e.clientX, e.clientY);
                if (detectedTrackId) {
                    const project = useVideoEditorStore.getState().project;
                    const targetTrack = project.tracks.find(t => t.id === detectedTrackId);
                    if (targetTrack && isClipCompatibleWithTrack({ type: current.clipType }, targetTrack)) {
                        targetTrackId = detectedTrackId;
                        current.currentTrackId = targetTrackId;
                    }
                }
            }

            const deltaFrames = Math.round((e.clientX - current.startX) / current.pxPerFrame);
            const ctx: ClipDragContext = {
                origin: current.origin,
                deltaFrames,
                candidates: current.candidates,
                fps: current.fps,
                pxPerFrame: current.pxPerFrame,
                targetTrackId,
            };

            const updates = current.type === 'move'
                ? computeMoveUpdate(ctx)
                : computeTrimUpdate(ctx, current.type);

            const indicator = updates.snapIndicatorFrame ?? null;
            setSnapIndicatorFrame(indicator);
            useSnapIndicatorStore.getState().setSnapIndicatorFrame(indicator);

            updateClipTransientRef.current(current.clipId, updates);
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- throttle HoF requires any[] constraint
        const handleMouseMove = throttle(_moveCb as (...a: any[]) => any, 16);

        const handleMouseUp = (e: MouseEvent) => {
            const current = dragStateRef.current;
            if (current) {
                let targetTrackId = current.currentTrackId;
                if (current.type === 'move') {
                    const detectedTrackId = findTrackAtPoint(e.clientX, e.clientY);
                    if (detectedTrackId) {
                        const project = useVideoEditorStore.getState().project;
                        const targetTrack = project.tracks.find(t => t.id === detectedTrackId);
                        if (targetTrack && isClipCompatibleWithTrack({ type: current.clipType }, targetTrack)) {
                            targetTrackId = detectedTrackId;
                        }
                    }
                }

                const deltaFrames = Math.round((e.clientX - current.startX) / current.pxPerFrame);
                const ctx: ClipDragContext = {
                    origin: current.origin,
                    deltaFrames,
                    candidates: current.candidates,
                    fps: current.fps,
                    pxPerFrame: current.pxPerFrame,
                    targetTrackId,
                };
                const finalUpdates = current.type === 'move'
                    ? computeMoveUpdate(ctx)
                    : computeTrimUpdate(ctx, current.type);
                commitTransientClipUpdateRef.current(current.clipId, finalUpdates);
            }
            setSnapIndicatorFrame(null);
            useSnapIndicatorStore.getState().setSnapIndicatorFrame(null);
            setDragState(null);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dragStateRef.current) {
                abortTransientClipUpdateRef.current();
                setSnapIndicatorFrame(null);
                useSnapIndicatorStore.getState().setSnapIndicatorFrame(null);
                setDragState(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return {
        dragState,
        handleDragStart,
        snapIndicatorFrame,
    };
}
