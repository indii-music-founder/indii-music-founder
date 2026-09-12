import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelineDrag, computeMoveUpdate, findTrackAtPoint } from './useTimelineDrag';
import { isClipCompatibleWithTrack } from '../utils/timelineUtils';
import { useVideoEditorStore, VideoProject } from '../../store/videoEditorStore';

// Un-stub global setup's store mock so authentic store mutations execute
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());
vi.mock('../../store/videoEditorStore', async (importOriginal) => importOriginal());

describe('multi-track dragging (Feature 18)', () => {
    describe('isClipCompatibleWithTrack', () => {
        it('allows audio clips only on audio tracks', () => {
            expect(isClipCompatibleWithTrack({ type: 'audio' }, { type: 'audio' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'audio' }, { type: 'video' })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'audio' }, { type: 'image' })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'audio' }, { type: 'text' })).toBe(false);
        });

        it('disallows visual clips on audio tracks', () => {
            expect(isClipCompatibleWithTrack({ type: 'video' }, { type: 'audio' })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'image' }, { type: 'audio' })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'text' }, { type: 'audio' })).toBe(false);
        });

        it('allows visual clips on compatible visual tracks', () => {
            // Video clips
            expect(isClipCompatibleWithTrack({ type: 'video' }, { type: 'video' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'video' }, { type: 'image' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'video' }, { type: 'text' })).toBe(false);

            // Image clips
            expect(isClipCompatibleWithTrack({ type: 'image' }, { type: 'image' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'image' }, { type: 'video' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'image' }, { type: 'text' })).toBe(false);

            // Text clips
            expect(isClipCompatibleWithTrack({ type: 'text' }, { type: 'text' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'text' }, { type: 'video' })).toBe(true);
            expect(isClipCompatibleWithTrack({ type: 'text' }, { type: 'image' })).toBe(false);
        });

        it('rejects any clip movement onto locked tracks', () => {
            expect(isClipCompatibleWithTrack({ type: 'video' }, { type: 'video', isLocked: true })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'audio' }, { type: 'audio', isLocked: true })).toBe(false);
            expect(isClipCompatibleWithTrack({ type: 'text' }, { type: 'text', isLocked: true })).toBe(false);
        });
    });

    describe('computeMoveUpdate multi-track resolution', () => {
        it('includes trackId when moving to a different target track', () => {
            const update = computeMoveUpdate({
                origin: { startFrame: 30, durationInFrames: 60, trackId: 'track-1' },
                deltaFrames: 0,
                candidates: [],
                fps: 30,
                pxPerFrame: 2,
                targetTrackId: 'track-2',
            });
            expect(update.trackId).toBe('track-2');
            expect(update.startFrame).toBe(30);
        });

        it('omits trackId when targetTrackId is identical to origin track', () => {
            const update = computeMoveUpdate({
                origin: { startFrame: 30, durationInFrames: 60, trackId: 'track-1' },
                deltaFrames: 0,
                candidates: [],
                fps: 30,
                pxPerFrame: 2,
                targetTrackId: 'track-1',
            });
            expect(update.trackId).toBeUndefined();
        });

        it('omits trackId when targetTrackId is undefined', () => {
            const update = computeMoveUpdate({
                origin: { startFrame: 30, durationInFrames: 60, trackId: 'track-1' },
                deltaFrames: 0,
                candidates: [],
                fps: 30,
                pxPerFrame: 2,
            });
            expect(update.trackId).toBeUndefined();
        });
    });

    describe('findTrackAtPoint detection', () => {
        let container: HTMLDivElement;

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        afterEach(() => {
            document.body.removeChild(container);
            (document as unknown as { elementFromPoint?: unknown }).elementFromPoint = undefined;
            vi.restoreAllMocks();
        });

        it('detects track using document.elementFromPoint', () => {
            const trackDiv = document.createElement('div');
            trackDiv.setAttribute('data-track-id', 'track-alpha');
            container.appendChild(trackDiv);

            const innerDiv = document.createElement('div');
            trackDiv.appendChild(innerDiv);

            document.elementFromPoint = vi.fn().mockReturnValue(innerDiv);

            const found = findTrackAtPoint(100, 200);
            expect(found).toBe('track-alpha');
        });

        it('falls back to getBoundingClientRect when elementFromPoint returns null', () => {
            const trackDiv = document.createElement('div');
            trackDiv.setAttribute('data-track-id', 'track-beta');
            trackDiv.getBoundingClientRect = () => ({
                top: 150,
                bottom: 250,
                left: 0,
                right: 800,
                width: 800,
                height: 100,
                x: 0,
                y: 150,
                toJSON: () => {},
            });
            container.appendChild(trackDiv);

            document.elementFromPoint = vi.fn().mockReturnValue(null);

            const found = findTrackAtPoint(100, 200);
            expect(found).toBe('track-beta');
        });

        it('returns null when point is outside all track bounds', () => {
            const trackDiv = document.createElement('div');
            trackDiv.setAttribute('data-track-id', 'track-gamma');
            trackDiv.getBoundingClientRect = () => ({
                top: 100,
                bottom: 200,
                left: 0,
                right: 800,
                width: 800,
                height: 100,
                x: 0,
                y: 100,
                toJSON: () => {},
            });
            container.appendChild(trackDiv);

            document.elementFromPoint = vi.fn().mockReturnValue(null);

            const found = findTrackAtPoint(100, 350);
            expect(found).toBeNull();
        });
    });

    describe('useTimelineDrag cross-track movement integration', () => {
        let trackContainer: HTMLDivElement;

        const initialProject: VideoProject = {
            id: 'proj-1',
            name: 'Multi-Track Test',
            fps: 30,
            durationInFrames: 300,
            width: 1920,
            height: 1080,
            tracks: [
                { id: 'track-v1', name: 'Video 1', type: 'video', isLocked: false, isMuted: false, isSolo: false },
                { id: 'track-v2', name: 'Video 2', type: 'video', isLocked: false, isMuted: false, isSolo: false },
                { id: 'track-a1', name: 'Audio 1', type: 'audio', isLocked: false, isMuted: false, isSolo: false },
            ],
            clips: [
                {
                    id: 'clip-video-1',
                    name: 'Sample Video',
                    type: 'video',
                    trackId: 'track-v1',
                    startFrame: 10,
                    durationInFrames: 60,
                },
                {
                    id: 'clip-audio-1',
                    name: 'Sample Audio',
                    type: 'audio',
                    trackId: 'track-a1',
                    startFrame: 0,
                    durationInFrames: 90,
                },
            ],
        };

        beforeEach(() => {
            useVideoEditorStore.getState().setProject(initialProject);
            useVideoEditorStore.setState({ past: [], future: [] });

            trackContainer = document.createElement('div');
            document.body.appendChild(trackContainer);

            const v1El = document.createElement('div');
            v1El.setAttribute('data-track-id', 'track-v1');
            v1El.getBoundingClientRect = () => ({
                top: 0, bottom: 60, left: 0, right: 800, width: 800, height: 60, x: 0, y: 0, toJSON: () => {}
            });
            trackContainer.appendChild(v1El);

            const v2El = document.createElement('div');
            v2El.setAttribute('data-track-id', 'track-v2');
            v2El.getBoundingClientRect = () => ({
                top: 61, bottom: 120, left: 0, right: 800, width: 800, height: 60, x: 0, y: 61, toJSON: () => {}
            });
            trackContainer.appendChild(v2El);

            const a1El = document.createElement('div');
            a1El.setAttribute('data-track-id', 'track-a1');
            a1El.getBoundingClientRect = () => ({
                top: 121, bottom: 180, left: 0, right: 800, width: 800, height: 60, x: 0, y: 121, toJSON: () => {}
            });
            trackContainer.appendChild(a1El);
        });

        afterEach(() => {
            document.body.removeChild(trackContainer);
            (document as unknown as { elementFromPoint?: unknown }).elementFromPoint = undefined;
            vi.restoreAllMocks();
        });

        it('moves a visual clip to another compatible visual track on mouseup', () => {
            const clip = useVideoEditorStore.getState().project.clips[0]!; // clip-video-1 on track-v1
            const { result } = renderHook(() => useTimelineDrag());

            // 1. Start drag at clientX: 20, clientY: 30 (over track-v1)
            act(() => {
                const fakeEvent = {
                    stopPropagation: () => {},
                    preventDefault: () => {},
                    clientX: 20,
                    clientY: 30,
                } as unknown as React.MouseEvent;
                result.current.handleDragStart(fakeEvent, clip, 'move');
            });

            // 2. Dispatch mousemove down to clientY: 90 (over track-v2)
            act(() => {
                window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 90 }));
            });

            // 3. Dispatch mouseup at clientY: 90
            act(() => {
                window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 90 }));
            });

            // Verify clip was moved to track-v2 in store
            const updatedClip = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-video-1')!;
            expect(updatedClip.trackId).toBe('track-v2');
        });

        it('refuses to move a video clip to an incompatible audio track', () => {
            const clip = useVideoEditorStore.getState().project.clips[0]!; // clip-video-1 on track-v1
            const { result } = renderHook(() => useTimelineDrag());

            // 1. Start drag over track-v1
            act(() => {
                const fakeEvent = {
                    stopPropagation: () => {},
                    preventDefault: () => {},
                    clientX: 20,
                    clientY: 30,
                } as unknown as React.MouseEvent;
                result.current.handleDragStart(fakeEvent, clip, 'move');
            });

            // 2. Dispatch mousemove down to clientY: 150 (over audio track-a1)
            act(() => {
                window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 150 }));
            });

            // 3. Dispatch mouseup at clientY: 150
            act(() => {
                window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 150 }));
            });

            // Clip must stay on track-v1, NOT move to track-a1!
            const updatedClip = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-video-1')!;
            expect(updatedClip.trackId).toBe('track-v1');
        });
    });
});
