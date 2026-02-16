import { renderHook, act } from '@testing-library/react';
import { useVideoEditorStore } from './videoEditorStore';
import { vi } from 'vitest';

describe('useVideoEditorStore', () => {
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

        const clipId = result.current.project.clips[0].id;

        act(() => {
            result.current.updateClip(clipId, {
                keyframes: {
                    scale: [{ frame: 0, value: 1 }, { frame: 50, value: 2 }]
                }
            });
        });

        expect(result.current.project.clips[0].keyframes?.scale).toHaveLength(2);
        expect(result.current.project.clips[0].keyframes?.scale[1].value).toBe(2);
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

        const clipId = result.current.project.clips[0].id;

        // Add Keyframe
        act(() => {
            result.current.addKeyframe(clipId, 'opacity', 10, 0.5);
        });

        expect(result.current.project.clips[0].keyframes?.opacity).toHaveLength(1);
        expect(result.current.project.clips[0].keyframes?.opacity[0]).toEqual({ frame: 10, value: 0.5 });

        // Update Keyframe (value and easing)
        act(() => {
            result.current.updateKeyframe(clipId, 'opacity', 10, { value: 0.8, easing: 'easeIn' });
        });

        expect(result.current.project.clips[0].keyframes?.opacity[0]).toEqual({ frame: 10, value: 0.8, easing: 'easeIn' });

        // Remove Keyframe
        act(() => {
            result.current.removeKeyframe(clipId, 'opacity', 10);
        });

        expect(result.current.project.clips[0].keyframes?.opacity).toHaveLength(0);
    });
});
