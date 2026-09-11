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
        expect(clips[1]).toMatchObject({ startFrame:12, durationInFrames: 18, name: 'Take 1 B', sourceInUs: 400_000, sourceOutUs: 1_000_000 });
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

    it('partitions keyframes between left and right halves and offsets right keyframes', () => {
        useVideoEditorStore.setState(state => ({
            project: {
                ...state.project,
                clips: [
                    {
                        id: 'c1',
                        type: 'video',
                        startFrame: 0,
                        durationInFrames: 30,
                        trackId: 'track-1',
                        name: 'Take 1',
                        src: 'a.mp4',
                        keyframes: {
                            opacity: [
                                { frame: 5, value: 0.2 },
                                { frame: 15, value: 0.5 },
                                { frame: 25, value: 1.0 },
                            ],
                            scale: [
                                { frame: 0, value: 1.0 },
                                { frame: 20, value: 2.0 },
                            ],
                        },
                    },
                ],
            },
            selectedClipId: 'c1',
        }));

        useVideoEditorStore.getState().splitClip('c1', 15);

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips).toHaveLength(2);

        const left = clips[0]!;
        const right = clips[1]!;

        expect(left.durationInFrames).toBe(15);
        expect(left.keyframes?.opacity).toEqual([{ frame: 5, value: 0.2 }]);
        expect(left.keyframes?.scale).toEqual([{ frame: 0, value: 1.0 }]);

        expect(right.startFrame).toBe(15);
        expect(right.durationInFrames).toBe(15);
        expect(right.keyframes?.opacity).toEqual([
            { frame: 0, value: 0.5 },
            { frame: 10, value: 1.0 },
        ]);
        expect(right.keyframes?.scale).toEqual([{ frame: 5, value: 2.0 }]);

        // Selection is updated to the active split piece (right half)
        expect(useVideoEditorStore.getState().selectedClipId).toBe(right.id);
    });

    it('handles floating point split positions with Math.round', () => {
        useVideoEditorStore.getState().splitClip('c1', 14.8);

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips).toHaveLength(2);
        expect(clips[0]).toMatchObject({ startFrame: 0, durationInFrames: 15 });
        expect(clips[1]).toMatchObject({ startFrame: 15, durationInFrames: 15 });
    });

    it('expands project duration when duplicate extends beyond existing duration', () => {
        useVideoEditorStore.setState(state => ({
            project: {
                ...state.project,
                durationInFrames: 45,
                clips: [
                    { id: 'c1', type: 'video', startFrame: 20, durationInFrames: 30, trackId: 'track-1', name: 'Take 1', src: 'a.mp4' },
                ],
            },
            selectedClipId: 'c1',
        }));

        useVideoEditorStore.getState().duplicateClip('c1');

        const state = useVideoEditorStore.getState();
        expect(state.project.clips).toHaveLength(2);
        const copy = state.project.clips[1]!;
        expect(copy.startFrame).toBe(50);
        expect(copy.durationInFrames).toBe(30);
        // Project duration expanded to 50 + 30 = 80
        expect(state.project.durationInFrames).toBe(80);
        // Duplicate is selected
        expect(state.selectedClipId).toBe(copy.id);
    });

    it('deep-clones keyframes during duplication so original and copy remain isolated', () => {
        useVideoEditorStore.setState(state => ({
            project: {
                ...state.project,
                clips: [
                    {
                        id: 'c1',
                        type: 'video',
                        startFrame: 0,
                        durationInFrames: 30,
                        trackId: 'track-1',
                        name: 'Take 1',
                        src: 'a.mp4',
                        keyframes: {
                            opacity: [{ frame: 0, value: 1 }],
                        },
                    },
                ],
            },
        }));

        useVideoEditorStore.getState().duplicateClip('c1');

        const [orig, copy] = useVideoEditorStore.getState().project.clips;
        expect(copy!.keyframes?.opacity).toEqual([{ frame: 0, value: 1 }]);
        expect(copy!.keyframes).not.toBe(orig!.keyframes);
        expect(copy!.keyframes?.opacity).not.toBe(orig!.keyframes?.opacity);
    });
});

describe('videoEditorStore — ripple delete', () => {
    beforeEach(() => {
        useVideoEditorStore.setState({
            project: {
                ...blankProjectForId('proj-1'),
                tracks: [
                    { id: 'track-1', name: 'V1', type: 'video' },
                    { id: 'track-2', name: 'V2', type: 'video' },
                ],
                clips: [
                    { id: 'c1', type: 'video', startFrame: 0, durationInFrames: 30, trackId: 'track-1', name: 'One', src: 'a.mp4' },
                    { id: 'c2', type: 'video', startFrame: 30, durationInFrames: 30, trackId: 'track-1', name: 'Two', src: 'b.mp4' },
                    { id: 'c3', type: 'video', startFrame: 60, durationInFrames: 30, trackId: 'track-1', name: 'Three', src: 'c.mp4' },
                    { id: 'c9', type: 'video', startFrame: 30, durationInFrames: 30, trackId: 'track-2', name: 'Other track', src: 'd.mp4' },
                ],
            },
        });
    });

    it('deletes the clip and slides later clips on the same track left to close the gap', () => {
        useVideoEditorStore.getState().rippleDeleteClip('c2');

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips.map(c => c.id)).toEqual(['c1', 'c3', 'c9']);
        expect(clips.find(c => c.id === 'c3')).toMatchObject({ startFrame: 30, durationInFrames: 30 });
        expect(clips.find(c => c.id === 'c1')).toMatchObject({ startFrame: 0 });
        // Other tracks never move.
        expect(clips.find(c => c.id === 'c9')).toMatchObject({ startFrame: 30 });
    });

    it('leaves clips that overlap the deleted clip untouched', () => {
        useVideoEditorStore.setState(state => ({
            project: {
                ...state.project,
                clips: [
                    ...state.project.clips,
                    { id: 'c5', type: 'video', startFrame: 20, durationInFrames: 20, trackId: 'track-1', name: 'Overlap', src: 'e.mp4' },
                ],
            },
        }));
        useVideoEditorStore.getState().rippleDeleteClip('c1');

        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips.find(c => c.id === 'c5')).toMatchObject({ startFrame: 20 });
        // A clip starting exactly at the deleted end closes the gap.
        expect(clips.find(c => c.id === 'c2')).toMatchObject({ startFrame: 0 });
    });

    it('no-ops on a missing clip', () => {
        useVideoEditorStore.getState().rippleDeleteClip('missing');
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(4);
    });

    it('resets selectedClipId to null if the ripple-deleted clip was selected', () => {
        useVideoEditorStore.setState({ selectedClipId: 'c2' });
        useVideoEditorStore.getState().rippleDeleteClip('c2');

        expect(useVideoEditorStore.getState().selectedClipId).toBeNull();
    });

    it('preserves selectedClipId if a different clip was selected during ripple delete', () => {
        useVideoEditorStore.setState({ selectedClipId: 'c1' });
        useVideoEditorStore.getState().rippleDeleteClip('c2');

        expect(useVideoEditorStore.getState().selectedClipId).toBe('c1');
    });
});
