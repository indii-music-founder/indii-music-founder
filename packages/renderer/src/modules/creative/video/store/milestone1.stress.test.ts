import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoEditorStore, type VideoProject } from './videoEditorStore';
import { easeValue, interpolateKeyframeValue, getKeyframeColor } from '../editor/utils/keyframeUtils';
import type { IndiiVideoKeyframe } from '@indii/shared';
import { vi } from 'vitest';

vi.unmock('@/modules/creative/video/store/videoEditorStore');
vi.unmock('@/services/MembershipService');

describe('Milestone 1 Adversarial Stress Test Suite (Challenger 2)', () => {
    beforeEach(() => {
        const store = useVideoEditorStore.getState();
        store.setProject({
            id: 'stress-project',
            name: 'Stress Test Project',
            fps: 30,
            durationInFrames: 300,
            width: 1920,
            height: 1080,
            tracks: [
                { id: 'v1', name: 'Video 1', type: 'video', isMuted: false, isLocked: false, isSolo: false },
                { id: 'v2', name: 'Video 2', type: 'video', isMuted: false, isLocked: false, isSolo: false },
                { id: 'a1', name: 'Audio 1', type: 'audio', isMuted: false, isLocked: false, isSolo: false },
                { id: 'img1', name: 'Image 1', type: 'image', isMuted: false, isLocked: false, isSolo: false },
            ],
            clips: []
        });
        useVideoEditorStore.setState({ past: [], future: [], selectedClipId: null });
    });

    // =========================================================================
    // AREA 1: duplicateClip Expansion, Undo/Redo & Boundary Stress
    // =========================================================================
    describe('1. duplicateClip expansion & boundary stress', () => {
        it('expands project duration when duplicated clip extends past timeline boundary', () => {
            const store = useVideoEditorStore.getState();
            store.addClip({
                type: 'video',
                name: 'End Clip',
                startFrame: 250,
                durationInFrames: 100,
                trackId: 'v1'
            });

            const originalClip = useVideoEditorStore.getState().project.clips[0]!;
            expect(originalClip).toBeDefined();
            expect(useVideoEditorStore.getState().project.durationInFrames).toBe(350);

            // Duplicate clip: placed right after original at frame 250 + 100 = 350.
            // Copy end frame is 350 + 100 = 450. Project duration must expand to 450.
            store.duplicateClip(originalClip.id);

            const state = useVideoEditorStore.getState();
            expect(state.project.clips).toHaveLength(2);
            const copy = state.project.clips.find(c => c.id !== originalClip.id)!;
            expect(copy).toBeDefined();
            expect(copy.startFrame).toBe(350);
            expect(copy.durationInFrames).toBe(100);
            expect(copy.trackId).toBe('v1');
            expect(state.project.durationInFrames).toBe(450);
            expect(state.selectedClipId).toBe(copy.id);
        });

        it('supports cascading successive duplicates with linear timeline progression', () => {
            const store = useVideoEditorStore.getState();
            store.addClip({
                type: 'video',
                name: 'Base',
                startFrame: 0,
                durationInFrames: 60,
                trackId: 'v1'
            });

            let currentId = useVideoEditorStore.getState().project.clips[0]!.id;

            // Cascade duplicate 5 times by duplicating the newly created copy each time
            for (let i = 1; i <= 5; i++) {
                store.duplicateClip(currentId);
                const nextState = useVideoEditorStore.getState();
                expect(nextState.project.clips).toHaveLength(i + 1);
                const newCopyId = nextState.selectedClipId!;
                expect(newCopyId).not.toBe(currentId);

                const newCopy = nextState.project.clips.find(c => c.id === newCopyId)!;
                expect(newCopy.startFrame).toBe(i * 60);
                expect(newCopy.durationInFrames).toBe(60);

                currentId = newCopyId;
            }

            const finalState = useVideoEditorStore.getState();
            expect(finalState.project.clips).toHaveLength(6);
            expect(finalState.project.durationInFrames).toBe(360);
        });

        it('supports full undo and redo cycles for duplicateClip', () => {
            const store = useVideoEditorStore.getState();
            store.addClip({
                type: 'video',
                name: 'Undoable Clip',
                startFrame: 200,
                durationInFrames: 100,
                trackId: 'v1'
            });

            const orig = useVideoEditorStore.getState().project.clips[0]!;
            useVideoEditorStore.setState({ past: [], future: [] });

            // Duplicate clip (expands duration to 400)
            store.duplicateClip(orig.id);
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(2);
            expect(useVideoEditorStore.getState().project.durationInFrames).toBe(400);
            expect(useVideoEditorStore.getState().past).toHaveLength(1);

            // Undo duplication
            store.undo();
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.durationInFrames).toBe(300);
            expect(useVideoEditorStore.getState().future).toHaveLength(1);

            // Redo duplication
            store.redo();
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(2);
            expect(useVideoEditorStore.getState().project.durationInFrames).toBe(400);
        });

        it('ensures deep isolation of keyframes on duplicated clips', () => {
            const store = useVideoEditorStore.getState();
            store.addClip({
                type: 'video',
                name: 'Keyframed Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: 'v1',
                keyframes: {
                    volume: [
                        { frame: 0, value: 0.2, easing: 'linear' },
                        { frame: 50, value: 0.8, easing: 'easeInOut' }
                    ],
                    scale: [
                        { frame: 0, value: 1, easing: 'easeOut' }
                    ]
                }
            });

            const origId = useVideoEditorStore.getState().project.clips[0]!.id;
            store.duplicateClip(origId);

            const state = useVideoEditorStore.getState();
            const copy = state.project.clips.find(c => c.id !== origId)!;

            expect(copy.keyframes?.volume).toHaveLength(2);
            expect(copy.keyframes?.scale).toHaveLength(1);

            // Mutate copy keyframes via store action
            store.updateKeyframe(copy.id, 'volume', 50, { value: 1.0 });

            // Ensure original clip's keyframes are completely unchanged
            const origAfter = useVideoEditorStore.getState().project.clips.find(c => c.id === origId)!;
            const copyAfter = useVideoEditorStore.getState().project.clips.find(c => c.id === copy.id)!;

            expect(origAfter.keyframes?.volume![1]!.value).toBe(0.8);
            expect(copyAfter.keyframes?.volume![1]!.value).toBe(1.0);
        });

        it('handles clip with empty or malformed keyframe containers', () => {
            const store = useVideoEditorStore.getState();
            store.addClip({
                type: 'video',
                name: 'Empty Keyframes Clip',
                startFrame: 10,
                durationInFrames: 50,
                trackId: 'v1',
                keyframes: {
                    volume: [],
                    rotation: undefined as any
                }
            });

            const origId = useVideoEditorStore.getState().project.clips[0]!.id;
            expect(() => store.duplicateClip(origId)).not.toThrow();

            const copy = useVideoEditorStore.getState().project.clips.find(c => c.id !== origId)!;
            expect(copy.keyframes?.volume).toEqual([]);
            expect(copy.keyframes?.rotation).toEqual([]);
        });

        it('gracefully handles duplicating nonexistent clip without state pollution', () => {
            const store = useVideoEditorStore.getState();
            const initialClips = store.project.clips.length;
            const initialPast = store.past.length;

            store.duplicateClip('non-existent-id-999');

            expect(useVideoEditorStore.getState().project.clips.length).toBe(initialClips);
            expect(useVideoEditorStore.getState().past.length).toBe(initialPast);
        });
    });

    // =========================================================================
    // AREA 2: rippleDeleteClip Selection Cleanup, Undo & Track Shifts
    // =========================================================================
    describe('2. rippleDeleteClip selection cleanup & track offset shifts', () => {
        beforeEach(() => {
            const store = useVideoEditorStore.getState();
            // Track v1:
            // c1: [0, 50]
            // c2: [50, 100]  (contiguous)
            // c3: [120, 200] (gap of 20 frames from 100 to 120, duration 80)
            // Track a1:
            // a_c1: [0, 80]
            // a_c2: [90, 180]
            store.setProject({
                ...store.project,
                clips: [
                    { id: 'c1', name: 'Clip 1', type: 'video', trackId: 'v1', startFrame: 0, durationInFrames: 50 },
                    { id: 'c2', name: 'Clip 2', type: 'video', trackId: 'v1', startFrame: 50, durationInFrames: 50 },
                    { id: 'c3', name: 'Clip 3', type: 'video', trackId: 'v1', startFrame: 120, durationInFrames: 80 },
                    { id: 'a_c1', name: 'Audio 1', type: 'audio', trackId: 'a1', startFrame: 0, durationInFrames: 80 },
                    { id: 'a_c2', name: 'Audio 2', type: 'audio', trackId: 'a1', startFrame: 90, durationInFrames: 90 },
                ]
            });
            useVideoEditorStore.setState({ past: [], future: [] });
        });

        it('ripple deletes the first clip, shifting subsequent clips left and preserving relative gaps', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('c1');

            store.rippleDeleteClip('c1');

            const state = useVideoEditorStore.getState();
            expect(state.selectedClipId).toBeNull();

            const v1Clips = state.project.clips.filter(c => c.trackId === 'v1');
            expect(v1Clips).toHaveLength(2);

            // c2 shifts 50 -> 0
            const c2 = v1Clips.find(c => c.id === 'c2')!;
            expect(c2.startFrame).toBe(0);
            expect(c2.durationInFrames).toBe(50);

            // c3 shifts 120 -> 70 (preserves gap of 20)
            const c3 = v1Clips.find(c => c.id === 'c3')!;
            expect(c3.startFrame).toBe(70);
            expect(c3.durationInFrames).toBe(80);

            // Audio track clips must be untouched!
            const a1Clips = state.project.clips.filter(c => c.trackId === 'a1');
            expect(a1Clips).toHaveLength(2);
            expect(a1Clips.find(c => c.id === 'a_c1')!.startFrame).toBe(0);
            expect(a1Clips.find(c => c.id === 'a_c2')!.startFrame).toBe(90);
        });

        it('supports undo and redo on rippleDeleteClip', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('c2');

            store.rippleDeleteClip('c2');
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(4);
            expect(useVideoEditorStore.getState().selectedClipId).toBeNull();

            // Undo
            store.undo();
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(5);
            const c2Restored = useVideoEditorStore.getState().project.clips.find(c => c.id === 'c2')!;
            expect(c2Restored).toBeDefined();
            expect(c2Restored.startFrame).toBe(50);
            const c3Restored = useVideoEditorStore.getState().project.clips.find(c => c.id === 'c3')!;
            expect(c3Restored.startFrame).toBe(120);

            // Redo
            store.redo();
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(4);
            expect(useVideoEditorStore.getState().project.clips.find(c => c.id === 'c2')).toBeUndefined();
            expect(useVideoEditorStore.getState().project.clips.find(c => c.id === 'c3')!.startFrame).toBe(70);
        });

        it('ripple deletes middle clip, leaving preceding clips untouched and shifting trailing clips', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('c2');

            store.rippleDeleteClip('c2');

            const state = useVideoEditorStore.getState();
            expect(state.selectedClipId).toBeNull();

            const v1Clips = state.project.clips.filter(c => c.trackId === 'v1');
            expect(v1Clips).toHaveLength(2);

            // Preceding clip c1 must NOT move
            const c1 = v1Clips.find(c => c.id === 'c1')!;
            expect(c1.startFrame).toBe(0);

            // Trailing clip c3 was at 120, c2 duration was 50 -> shifts to 120 - 50 = 70
            const c3 = v1Clips.find(c => c.id === 'c3')!;
            expect(c3.startFrame).toBe(70);
        });

        it('ripple deletes last clip without affecting preceding clips', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('c3');

            store.rippleDeleteClip('c3');

            const state = useVideoEditorStore.getState();
            expect(state.selectedClipId).toBeNull();

            const v1Clips = state.project.clips.filter(c => c.trackId === 'v1');
            expect(v1Clips).toHaveLength(2);
            expect(v1Clips[0]!.id).toBe('c1');
            expect(v1Clips[0]!.startFrame).toBe(0);
            expect(v1Clips[1]!.id).toBe('c2');
            expect(v1Clips[1]!.startFrame).toBe(50);
        });

        it('preserves selectedClipId when ripple deleting an unselected clip', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('a_c1');

            store.rippleDeleteClip('c2');

            const state = useVideoEditorStore.getState();
            expect(state.selectedClipId).toBe('a_c1');
        });

        it('handles non-existent clip cleanly', () => {
            const store = useVideoEditorStore.getState();
            store.setSelectedClipId('c1');

            store.rippleDeleteClip('unknown-clip');

            const state = useVideoEditorStore.getState();
            expect(state.project.clips).toHaveLength(5);
            expect(state.selectedClipId).toBe('c1');
        });
    });

    // =========================================================================
    // AREA 3: Serialization Roundtrips
    // =========================================================================
    describe('3. JSON serialization roundtrips & type contracts', () => {
        it('serializes and deserializes full project state without loss of new track properties or keyframes', () => {
            const complexProject: VideoProject = {
                id: 'full-fidelity-project',
                name: 'Roundtrip Test',
                fps: 24,
                durationInFrames: 480,
                width: 3840,
                height: 2160,
                tracks: [
                    { id: 'trk-vid', name: '4K Main', type: 'video', isLocked: true, isSolo: false, isMuted: true },
                    { id: 'trk-img', name: 'Still Overlays', type: 'image', isLocked: false, isSolo: true, isMuted: false },
                    { id: 'trk-aud', name: 'Master Dialogue', type: 'audio', isLocked: false, isSolo: false, isMuted: false },
                ],
                clips: [
                    {
                        id: 'clip-1',
                        name: 'Intro 4K',
                        type: 'video',
                        trackId: 'trk-vid',
                        startFrame: 0,
                        durationInFrames: 240,
                        sourceInUs: 1_000_000,
                        sourceOutUs: 11_000_000,
                        playbackRate: 1.0,
                        volume: 0.85,
                        keyframes: {
                            volume: [
                                { frame: 0, value: 0.0, easing: 'linear' },
                                { frame: 24, value: 1.0, easing: 'easeIn' },
                                { frame: 216, value: 1.0, easing: 'easeOut' },
                                { frame: 240, value: 0.0, easing: 'easeInOut' },
                            ],
                            scale: [
                                { frame: 0, value: 1.0, easing: 'linear' },
                                { frame: 240, value: 1.25, easing: 'easeInOut' },
                            ],
                        }
                    },
                    {
                        id: 'clip-img',
                        name: 'Logo PNG',
                        type: 'image',
                        trackId: 'trk-img',
                        startFrame: 48,
                        durationInFrames: 96,
                        opacity: 0.9,
                    }
                ]
            };

            const serialized = JSON.stringify(complexProject);
            const deserialized: VideoProject = JSON.parse(serialized);

            // Deep equality check
            expect(deserialized).toEqual(complexProject);

            // Explicit checks on Milestone 1 type extensions
            const videoTrack = deserialized.tracks.find(t => t.id === 'trk-vid')!;
            expect(videoTrack.isLocked).toBe(true);
            expect(videoTrack.isMuted).toBe(true);
            expect(videoTrack.isSolo).toBe(false);

            const imageTrack = deserialized.tracks.find(t => t.id === 'trk-img')!;
            expect(imageTrack.type).toBe('image');
            expect(imageTrack.isSolo).toBe(true);
            expect(imageTrack.isLocked).toBe(false);

            const clip1 = deserialized.clips.find(c => c.id === 'clip-1')!;
            expect(clip1.keyframes?.volume).toHaveLength(4);
            expect(clip1.keyframes?.volume![3]!.easing).toBe('easeInOut');
            expect(clip1.keyframes?.scale![1]!.easing).toBe('easeInOut');

            // Now test restoring deserialized project into store
            const store = useVideoEditorStore.getState();
            store.setProject(deserialized);

            const storeProject = useVideoEditorStore.getState().project;
            expect(storeProject.id).toBe('full-fidelity-project');
            expect(storeProject.tracks[1]?.type).toBe('image');
            expect(storeProject.tracks[0]?.isLocked).toBe(true);
            expect(storeProject.clips[0]?.keyframes?.volume).toHaveLength(4);
        });

        it('retains integrity with empty and optional fields across JSON serialization', () => {
            const minimalProject: VideoProject = {
                id: 'min-proj',
                name: 'Minimal',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'Track', type: 'video' }],
                clips: [{
                    id: 'c1',
                    name: 'Clip',
                    type: 'video',
                    trackId: 't1',
                    startFrame: 0,
                    durationInFrames: 30
                }]
            };

            const roundtripped: VideoProject = JSON.parse(JSON.stringify(minimalProject));
            expect(roundtripped.tracks[0]!.isLocked).toBeUndefined();
            expect(roundtripped.tracks[0]!.isSolo).toBeUndefined();
            expect(roundtripped.clips[0]!.keyframes).toBeUndefined();

            const store = useVideoEditorStore.getState();
            store.setProject(roundtripped);

            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
        });
    });

    // =========================================================================
    // AREA 4: Keyframe Interpolation Curves & Boundary Stress
    // =========================================================================
    describe('4. keyframe interpolation curves & boundary stress', () => {
        describe('getKeyframeColor styling checks', () => {
            it('returns distinct color classes for each easing type', () => {
                expect(getKeyframeColor('easeIn')).toBe('bg-blue-400');
                expect(getKeyframeColor('easeOut')).toBe('bg-green-400');
                expect(getKeyframeColor('easeInOut')).toBe('bg-purple-400');
                expect(getKeyframeColor('linear')).toBe('bg-yellow-400');
                expect(getKeyframeColor('unknown')).toBe('bg-yellow-400');
                expect(getKeyframeColor(undefined)).toBe('bg-yellow-400');
            });
        });

        describe('easeValue boundary and extreme tests', () => {
            it('evaluates exact canonical boundary values for all curves', () => {
                const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut', undefined] as const;

                for (const easing of easings) {
                    expect(easeValue(0, easing)).toBe(0);
                    expect(easeValue(1, easing)).toBe(1);
                }

                // Midpoint evaluations
                expect(easeValue(0.5, 'linear')).toBe(0.5);
                expect(easeValue(0.5, 'easeIn')).toBe(0.25);
                expect(easeValue(0.5, 'easeOut')).toBe(0.75);
                expect(easeValue(0.5, 'easeInOut')).toBe(0.5);
            });

            it('clamps negative inputs to 0 and inputs > 1 to 1', () => {
                const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;

                for (const easing of easings) {
                    expect(easeValue(-0.0001, easing)).toBe(0);
                    expect(easeValue(-100, easing)).toBe(0);
                    expect(easeValue(-Infinity, easing)).toBe(0);
                    expect(easeValue(1.0001, easing)).toBe(1);
                    expect(easeValue(100, easing)).toBe(1);
                    expect(easeValue(Infinity, easing)).toBe(1);
                }
            });

            it('guarantees monotonic non-decreasing progression for all curves in [0, 1]', () => {
                const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
                const steps = 100;

                for (const easing of easings) {
                    let prevVal = -1;
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        const val = easeValue(t, easing);
                        expect(val).toBeGreaterThanOrEqual(prevVal - 1e-9);
                        expect(val).toBeGreaterThanOrEqual(0);
                        expect(val).toBeLessThanOrEqual(1);
                        prevVal = val;
                    }
                }
            });

            it('falls back to linear progression for unknown easing names', () => {
                expect(easeValue(0.25, 'cubic-bezier' as any)).toBe(0.25);
                expect(easeValue(0.75, 'unknown' as any)).toBe(0.75);
            });
        });

        describe('interpolateKeyframeValue boundary and stress tests', () => {
            it('handles empty and undefined keyframes safely', () => {
                expect(interpolateKeyframeValue(undefined, 10, 0.5)).toBe(0.5);
                expect(interpolateKeyframeValue([], 10, 0.5)).toBe(0.5);
                expect(interpolateKeyframeValue([], -5, 0.7)).toBe(0.7);
                expect(interpolateKeyframeValue(undefined, 0)).toBe(1); // default 1
            });

            it('returns the constant value for single-keyframe clips regardless of relativeFrame', () => {
                const single: IndiiVideoKeyframe[] = [{ frame: 50, value: 0.65, easing: 'easeInOut' }];

                expect(interpolateKeyframeValue(single, -100)).toBe(0.65);
                expect(interpolateKeyframeValue(single, 0)).toBe(0.65);
                expect(interpolateKeyframeValue(single, 50)).toBe(0.65);
                expect(interpolateKeyframeValue(single, 100)).toBe(0.65);
                expect(interpolateKeyframeValue(single, 100000)).toBe(0.65);
            });

            it('clamps correctly before first and after last keyframe', () => {
                const kfs: IndiiVideoKeyframe[] = [
                    { frame: 20, value: 0.1, easing: 'linear' },
                    { frame: 80, value: 0.9, easing: 'linear' },
                ];

                expect(interpolateKeyframeValue(kfs, -10)).toBe(0.1);
                expect(interpolateKeyframeValue(kfs, 0)).toBe(0.1);
                expect(interpolateKeyframeValue(kfs, 20)).toBe(0.1);
                expect(interpolateKeyframeValue(kfs, 80)).toBe(0.9);
                expect(interpolateKeyframeValue(kfs, 100)).toBe(0.9);
                expect(interpolateKeyframeValue(kfs, 9999)).toBe(0.9);
            });

            it('handles unsorted input keyframes by chronological sorting', () => {
                const unsorted: IndiiVideoKeyframe[] = [
                    { frame: 100, value: 1.0, easing: 'linear' },
                    { frame: 0, value: 0.0, easing: 'linear' },
                    { frame: 50, value: 0.5, easing: 'linear' },
                ];

                expect(interpolateKeyframeValue(unsorted, 25)).toBeCloseTo(0.25);
                expect(interpolateKeyframeValue(unsorted, 75)).toBeCloseTo(0.75);
            });

            it('handles colliding keyframes at identical timestamps without division by zero or NaN', () => {
                const colliding: IndiiVideoKeyframe[] = [
                    { frame: 20, value: 0.2, easing: 'linear' },
                    { frame: 20, value: 0.8, easing: 'linear' },
                ];

                const result = interpolateKeyframeValue(colliding, 20);
                expect(Number.isFinite(result)).toBe(true);
                expect(Number.isNaN(result)).toBe(false);
                expect(result).toBe(0.2);
            });

            it('accurately calculates easeIn, easeOut, and easeInOut interpolation', () => {
                // Ascending: 0 -> 100
                const kfEaseIn: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 0, easing: 'easeIn' },
                    { frame: 100, value: 100, easing: 'linear' },
                ];
                expect(interpolateKeyframeValue(kfEaseIn, 50)).toBeCloseTo(25);

                const kfEaseOut: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 0, easing: 'easeOut' },
                    { frame: 100, value: 100, easing: 'linear' },
                ];
                expect(interpolateKeyframeValue(kfEaseOut, 50)).toBeCloseTo(75);

                const kfEaseInOut: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 0, easing: 'easeInOut' },
                    { frame: 100, value: 100, easing: 'linear' },
                ];
                expect(interpolateKeyframeValue(kfEaseInOut, 50)).toBeCloseTo(50);
                expect(interpolateKeyframeValue(kfEaseInOut, 25)).toBeCloseTo(12.5);
                expect(interpolateKeyframeValue(kfEaseInOut, 75)).toBeCloseTo(87.5);
            });

            it('accurately calculates descending curves (fade out: 1.0 -> 0.0)', () => {
                // Descending: 1.0 -> 0.0
                const fadeEaseIn: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 1.0, easing: 'easeIn' },
                    { frame: 100, value: 0.0, easing: 'linear' },
                ];
                // At t = 0.5, easeIn = 0.25 -> 1.0 + (0.0 - 1.0) * 0.25 = 0.75
                expect(interpolateKeyframeValue(fadeEaseIn, 50)).toBeCloseTo(0.75);

                const fadeEaseOut: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 1.0, easing: 'easeOut' },
                    { frame: 100, value: 0.0, easing: 'linear' },
                ];
                // At t = 0.5, easeOut = 0.75 -> 1.0 + (0.0 - 1.0) * 0.75 = 0.25
                expect(interpolateKeyframeValue(fadeEaseOut, 50)).toBeCloseTo(0.25);

                const fadeEaseInOut: IndiiVideoKeyframe[] = [
                    { frame: 0, value: 1.0, easing: 'easeInOut' },
                    { frame: 100, value: 0.0, easing: 'linear' },
                ];
                // At t = 0.5, easeInOut = 0.5 -> 0.5
                expect(interpolateKeyframeValue(fadeEaseInOut, 50)).toBeCloseTo(0.5);
            });

            it('interpolates sub-frame floating point positions smoothly', () => {
                const kfs: IndiiVideoKeyframe[] = [
                    { frame: 10, value: 10, easing: 'linear' },
                    { frame: 20, value: 20, easing: 'linear' },
                ];

                expect(interpolateKeyframeValue(kfs, 15.5)).toBeCloseTo(15.5);
            });
        });
    });
});
