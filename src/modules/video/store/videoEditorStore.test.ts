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
});
