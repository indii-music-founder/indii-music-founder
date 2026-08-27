import { beforeEach, describe, expect, it, vi } from 'vitest';

import { blankProjectForId, useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

describe('videoEditorStore — loop region playback', () => {
    beforeEach(() => {
        useVideoEditorStore.setState({
            project: { ...blankProjectForId('proj-1'), durationInFrames: 300 },
            currentTime: 60,
            isPlaying: false,
            loopRegion: null,
        });
    });

    it('snaps the playhead back to the in-point when playback crosses the out-point', () => {
        useVideoEditorStore.getState().setLoopIn();      // a = 60
        useVideoEditorStore.setState({ currentTime: 120, isPlaying: true });
        useVideoEditorStore.getState().setLoopOut();     // b = 120
        expect(useVideoEditorStore.getState().loopRegion).toEqual({ a: 60, b: 120 });

        useVideoEditorStore.getState().setCurrentTime(121);
        expect(useVideoEditorStore.getState().currentTime).toBe(60);
    });

    it('leaves paused scrubbing unrestricted outside the region', () => {
        useVideoEditorStore.getState().setLoopIn();
        useVideoEditorStore.setState({ currentTime: 120 });
        useVideoEditorStore.getState().setLoopOut();

        useVideoEditorStore.getState().setCurrentTime(200);
        expect(useVideoEditorStore.getState().currentTime).toBe(200);
    });

    it('validates the region so the in-point always precedes the out-point', () => {
        useVideoEditorStore.setState({ currentTime: 0 });
        useVideoEditorStore.getState().setLoopIn(); // a=0, b=duration
        expect(useVideoEditorStore.getState().loopRegion).toEqual({ a: 0, b: 300 });

        // Moving the in-point past the existing out-point resets the region.
        useVideoEditorStore.setState({ currentTime: 150, loopRegion: { a: 0, b: 100 } });
        useVideoEditorStore.getState().setLoopIn();
        expect(useVideoEditorStore.getState().loopRegion).toEqual({ a: 0, b: 300 });
    });

    it('clears the region on request', () => {
        useVideoEditorStore.getState().setLoopIn();
        useVideoEditorStore.getState().clearLoop();
        expect(useVideoEditorStore.getState().loopRegion).toBeNull();
    });
});
