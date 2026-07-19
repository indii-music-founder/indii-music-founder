import { renderHook, act } from '@testing-library/react';
import { INITIAL_PROJECT, useVideoEditorStore } from './videoEditorStore';
import { vi } from 'vitest';

vi.unmock('@/modules/creative/video/store/videoEditorStore');
vi.unmock('@/services/MembershipService');

describe('useVideoEditorStore', () => {
    it('starts a production project without a framework title clip', () => {
        expect(INITIAL_PROJECT.clips).toEqual([]);
        expect(INITIAL_PROJECT.clips.some(clip => clip.text === 'Welcome to Remotion')).toBe(false);
    });

    beforeEach(() => {
        const store = useVideoEditorStore.getState();
        store.setProject({
            id: 'default-project',
            name: 'My Video Project',
            fps: 30,
            durationInFrames: 300,
            width: 1920,
            height: 1080,
            tracks: [],
            clips: []
        });
    });

    it('enforces standard duration limit', () => {
        const { result } = renderHook(() => useVideoEditorStore());

        act(() => {
            result.current.updateProjectSettings({ durationInFrames: 999999 });
        });

        // 8 minutes * 60 seconds * 30 fps = 14400 frames
        expect(result.current.project.durationInFrames).toBe(14400);
    });

    it('allows valid duration', () => {
        const { result } = renderHook(() => useVideoEditorStore());

        act(() => {
            result.current.updateProjectSettings({ durationInFrames: 500 });
        });

        expect(result.current.project.durationInFrames).toBe(500);
    });

    it('rejects invalid render dimensions and FPS at the store boundary', () => {
        const store = useVideoEditorStore.getState();
        store.updateProjectSettings({ width: Number.NaN, height: 0, fps: 999 });
        const project = useVideoEditorStore.getState().project;
        expect(project.width).toBe(1920);
        expect(project.height).toBe(1080);
        expect(project.fps).toBe(30);
    });

    it('keeps one importable track when the user removes tracks', () => {
        const store = useVideoEditorStore.getState();
        store.setProject({ id: 'one-track', name: 'One track', fps: 30, durationInFrames: 300, width: 1920, height: 1080, tracks: [{ id: 'only', name: 'Only', type: 'video' }], clips: [] });
        store.removeTrack('only');
        expect(useVideoEditorStore.getState().project.tracks).toHaveLength(1);
    });

    it('expands render duration for clips that extend beyond the project', () => {
        const store = useVideoEditorStore.getState();
        store.setProject({ id: 'timeline', name: 'Timeline', fps: 30, durationInFrames: 300, width: 1920, height: 1080, tracks: [{ id: 'video', name: 'Video', type: 'video' }], clips: [] });
        store.addClip({ type: 'video', name: 'Long clip', startFrame: 400, durationInFrames: 50, trackId: 'video' });
        expect(useVideoEditorStore.getState().project.durationInFrames).toBe(450);
    });

    it('adds and updates clips with keyframes', () => {
        const { result } = renderHook(() => useVideoEditorStore());

        act(() => {
            result.current.addClip({
                type: 'video',
                name: 'Test Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: 'track-1'
            });
        });

        const clipId = result.current.project.clips[0]!.id;

        act(() => {
            result.current.updateClip(clipId, {
                keyframes: {
                    scale: [{ frame: 0, value: 1 }, { frame: 50, value: 2 }]
                }
            });
        });

        expect(result.current.project.clips[0]!.keyframes?.scale).toHaveLength(2);
        expect(result.current.project.clips[0]!.keyframes?.scale![1]!.value).toBe(2);
    });

    it('manages keyframes via specific actions', () => {
        const { result } = renderHook(() => useVideoEditorStore());

        act(() => {
            result.current.addClip({
                type: 'video',
                name: 'Test Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: 'track-1'
            });
        });

        const clipId = result.current.project.clips[0]!.id;

        // Add Keyframe
        act(() => {
            result.current.addKeyframe(clipId, 'opacity', 10, 0.5);
        });

        expect(result.current.project.clips[0]!.keyframes?.opacity).toHaveLength(1);
        expect(result.current.project.clips[0]!.keyframes?.opacity![0]).toEqual({ frame: 10, value: 0.5 });

        // Update Keyframe (value and easing)
        act(() => {
            result.current.updateKeyframe(clipId, 'opacity', 10, { value: 0.8, easing: 'easeIn' });
        });

        expect(result.current.project.clips[0]!.keyframes?.opacity![0]).toEqual({ frame: 10, value: 0.8, easing: 'easeIn' });

        // Remove Keyframe
        act(() => {
            result.current.removeKeyframe(clipId, 'opacity', 10);
        });

        expect(result.current.project.clips[0]!.keyframes?.opacity).toHaveLength(0);
    });
});
