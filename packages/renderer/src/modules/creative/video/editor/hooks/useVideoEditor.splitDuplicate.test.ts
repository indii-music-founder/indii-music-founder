import { beforeEach, describe, expect, it, vi } from 'vitest';

import { blankProjectForId, useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

// Un-stub the global setup's store mock: these tests must prove the REAL cascade.
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

/** The real store, not the setup mock — these actions must prove cascade logic. */
describe('videoEditorStore — split and duplicate', () => {
    beforeEach(() => {
        useVideoEditorStore.setState({
            project: {
                ...blankProjectForId('proj-1'),
                clips: [
                    { id: 'c1', type: 'video', startFrame: 0, durationInFrames: 30, trackId: 'track-1', name: 'Take 1', src: 'a.mp4' },
                ],
            },
        });
    });

    it('splits a clip at the playhead into two adjacent, ordered clips', () => {
        useVideoEditorStore.getState().splitClip('c1', 12);

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips).toHaveLength(2);
        expect(clips[0]).toMatchObject({ startFrame: 0, durationInFrames: 12, name: 'Take 1 A' });
        expect(clips[1]).toMatchObject({ startFrame:12, durationInFrames: 18, name: 'Take 1 B' });
        expect(clips[0]!.id).not.toBe(clips[1]!.id);
        expect(clips[0]!.id).not.toBe('c1');
    });

    it('shifts source µs trims with the split so both halves cover the original media', () => {
        useVideoEditorStore.setState(state => ({
            project: {
                ...state.project,
                clips: state.project.clips.map(c => ({ ...c, sourceInUs: 250_000, sourceOutUs: 1_250_000 })),
            },
        }));
        useVideoEditorStore.getState().splitClip('c1', 12);

        const clips = useVideoEditorStore.getState().project.clips;
        // 12 frames @30fps = 400_000 µs
        expect(clips[0]).toMatchObject({ sourceInUs: 250_000, sourceOutUs: 650_000 });
        expect(clips[1]).toMatchObject({ sourceInUs: 650_000, sourceOutUs: 1_250_000 });
    });

    it('ignores a split at or beyond the clip boundary', () => {
        useVideoEditorStore.getState().splitClip('c1', 0);
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
        useVideoEditorStore.getState().splitClip('c1', 30);
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
        useVideoEditorStore.getState().splitClip('missing', 10);
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
    });

    it('duplicates a clip right after itself with a fresh id', () => {
        useVideoEditorStore.getState().duplicateClip('c1');

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips).toHaveLength(2);
        expect(clips[1]).toMatchObject({ startFrame: 30, durationInFrames: 30, trackId: 'track-1', name: 'Take 1 copy', src: 'a.mp4' });
        expect(clips[1]!.id).not.toBe('c1');
    });
});
