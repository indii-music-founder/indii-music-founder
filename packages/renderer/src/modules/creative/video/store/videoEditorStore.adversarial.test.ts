import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    blankProjectForId,
    useVideoEditorStore,
} from './videoEditorStore';
import { useTimelineDrag } from '../editor/hooks/useTimelineDrag';

// Un-stub the global setup's store mock to test authentic store logic
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

describe('videoEditorStore — Milestone 1 Adversarial Stress Testing', () => {
    beforeEach(() => {
        useVideoEditorStore.getState().abortTransientClipUpdate();
        useVideoEditorStore.setState({
            project: {
                ...blankProjectForId('stress-proj'),
                tracks: [
                    { id: 't-video-1', name: 'Main Video', type: 'video', isMuted: false, isLocked: false, isSolo: false },
                    { id: 't-audio-1', name: 'Main Audio', type: 'audio', isMuted: false, isLocked: false, isSolo: false },
                ],
                clips: [],
            },
            past: [],
            future: [],
            selectedClipId: null,
            currentTime: 0,
            previewArtifactUrl: null,
        });
    });

    // =========================================================================
    // 1. TRACK ACTIONS STRESS & ADVERSARIAL EDGE CASES
    // =========================================================================
    describe('Track Actions Adversarial Stress', () => {
        it('survives 100 rapid random track mutation cycles maintaining integrity invariants', () => {
            const store = useVideoEditorStore.getState();

            // Populate initial tracks and clips
            for (let i = 0; i < 5; i++) {
                store.addTrack(i % 2 === 0 ? 'video' : 'audio');
            }

            const trackIds = () => useVideoEditorStore.getState().project.tracks.map(t => t.id);

            // Seed 20 clips across available tracks
            for (let i = 0; i < 20; i++) {
                const currentTracks = trackIds();
                const assignedTrack = currentTracks[i % currentTracks.length]!;
                store.addClip({
                    type: 'video',
                    name: `Clip ${i}`,
                    startFrame: i * 10,
                    durationInFrames: 20,
                    trackId: assignedTrack,
                });
            }

            // Pseudo-random seed generator for deterministic reproduction
            let seed = 42;
            const pseudoRandom = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };

            for (let cycle = 0; cycle < 100; cycle++) {
                const actionRoll = Math.floor(pseudoRandom() * 7);
                const currentTracks = useVideoEditorStore.getState().project.tracks;
                const randomTrack = currentTracks[Math.floor(pseudoRandom() * currentTracks.length)]!;

                switch (actionRoll) {
                    case 0: // addTrack
                        store.addTrack(pseudoRandom() > 0.5 ? 'image' : 'text');
                        break;
                    case 1: // toggleMuteTrack
                        store.toggleMuteTrack(randomTrack.id);
                        break;
                    case 2: // toggleSoloTrack
                        store.toggleSoloTrack(randomTrack.id);
                        break;
                    case 3: // toggleLockTrack
                        store.toggleLockTrack(randomTrack.id);
                        break;
                    case 4: { // reorderTracks with extreme / valid indices
                        const len = currentTracks.length;
                        const from = Math.floor(pseudoRandom() * (len + 4)) - 2; // can be -2..len+1
                        const to = Math.floor(pseudoRandom() * (len + 4)) - 2;
                        store.reorderTracks(from, to);
                        break;
                    }
                    case 5: { // moveTrack
                        const targetIdx = Math.floor(pseudoRandom() * (currentTracks.length + 3)) - 1;
                        store.moveTrack(randomTrack.id, targetIdx);
                        break;
                    }
                    case 6: // removeTrack
                        store.removeTrack(randomTrack.id);
                        break;
                }

                // INVARIANTS CHECK AFTER EVERY OPERATION:
                const state = useVideoEditorStore.getState();
                const tracks = state.project.tracks;
                const clips = state.project.clips;

                // 1. At least 1 track must always remain
                expect(tracks.length).toBeGreaterThanOrEqual(1);

                // 2. All track IDs must be strictly unique
                const ids = tracks.map(t => t.id);
                expect(new Set(ids).size).toBe(tracks.length);

                // 3. No dangling clips: every clip must reference an existing track
                for (const clip of clips) {
                    expect(ids).toContain(clip.trackId);
                }

                // 4. Selection integrity: if a clip is selected, it must exist on an unlocked track
                if (state.selectedClipId !== null) {
                    const selClip = clips.find(c => c.id === state.selectedClipId);
                    expect(selClip).toBeDefined();
                    const parentTrack = tracks.find(t => t.id === selClip!.trackId);
                    expect(parentTrack).toBeDefined();
                    expect(parentTrack?.isLocked).toBe(false);
                }
            }
        });

        it('handles boundary clamping and invalid inputs for reorderTracks and moveTrack without polluting undo', () => {
            const store = useVideoEditorStore.getState();
            const initialTracks = useVideoEditorStore.getState().project.tracks;
            const pastBefore = useVideoEditorStore.getState().past.length;

            // Out of bounds start or end
            store.reorderTracks(-1, 0);
            store.reorderTracks(0, 999);
            store.reorderTracks(999, 0);
            store.reorderTracks(0, -5);
            // Identical indices
            store.reorderTracks(0, 0);
            store.reorderTracks(1, 1);
            // Non-integer inputs
            store.reorderTracks(0.5 as any, 1);
            store.reorderTracks(0, 1.8 as any);
            store.reorderTracks(NaN as any, 1);

            // moveTrack invalid calls
            store.moveTrack('nonexistent-track-id', 0);
            store.moveTrack(initialTracks[0]!.id, -1);
            store.moveTrack(initialTracks[0]!.id, 999);
            store.moveTrack(initialTracks[0]!.id, 0); // same index
            store.moveTrack(initialTracks[0]!.id, NaN as any);

            // Invariants: tracks unchanged, no undo entries pushed
            expect(useVideoEditorStore.getState().project.tracks).toEqual(initialTracks);
            expect(useVideoEditorStore.getState().past.length).toBe(pastBefore);
        });

        it('clears selectedClipId when locking the track containing the selected clip, but preserves other selections', () => {
            const store = useVideoEditorStore.getState();
            const tracks = useVideoEditorStore.getState().project.tracks;
            const t1 = tracks[0]!.id;
            const t2 = tracks[1]!.id;

            store.addClip({ type: 'video', name: 'C1', startFrame: 0, durationInFrames: 30, trackId: t1 });
            store.addClip({ type: 'audio', name: 'C2', startFrame: 0, durationInFrames: 30, trackId: t2 });
            const [c1] = useVideoEditorStore.getState().project.clips;

            // Select C1 (on t1)
            store.setSelectedClipId(c1!.id);
            expect(useVideoEditorStore.getState().selectedClipId).toBe(c1!.id);

            // Lock t2: should NOT affect C1
            store.toggleLockTrack(t2);
            expect(useVideoEditorStore.getState().selectedClipId).toBe(c1!.id);

            // Lock t1: MUST clear selectedClipId
            store.toggleLockTrack(t1);
            expect(useVideoEditorStore.getState().selectedClipId).toBeNull();

            // Unlock t1: selectedClipId remains null
            store.toggleLockTrack(t1);
            expect(useVideoEditorStore.getState().selectedClipId).toBeNull();
        });

        it('refuses to remove the last remaining track', () => {
            const store = useVideoEditorStore.getState();
            // Start with 2 tracks, remove 1
            const [t1, t2] = useVideoEditorStore.getState().project.tracks;
            store.removeTrack(t1!.id);
            expect(useVideoEditorStore.getState().project.tracks).toHaveLength(1);

            // Try removing the last track
            const pastBefore = useVideoEditorStore.getState().past.length;
            store.removeTrack(t2!.id);
            expect(useVideoEditorStore.getState().project.tracks).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.tracks[0]!.id).toBe(t2!.id);
            expect(useVideoEditorStore.getState().past.length).toBe(pastBefore);
        });
    });

    // =========================================================================
    // 2. SPLITCLIP KEYFRAME PARTITIONING & ADVERSARIAL CUT STRESS
    // =========================================================================
    describe('splitClip Keyframe Partitioning & Adversarial Stress', () => {
        it('refuses invalid cuts at edge boundaries, outside clip range, or non-finite frames', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Boundary Test',
                startFrame: 100,
                durationInFrames: 50, // spans [100, 150)
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;
            const pastBefore = useVideoEditorStore.getState().past.length;

            // Cuts exactly at boundaries
            store.splitClip(clipId, 100); // at startFrame
            store.splitClip(clipId, 150); // at endFrame
            // Cuts strictly outside boundaries
            store.splitClip(clipId, 99);
            store.splitClip(clipId, 50);
            store.splitClip(clipId, 151);
            store.splitClip(clipId, 300);
            // Non-finite frames
            store.splitClip(clipId, NaN);
            store.splitClip(clipId, Infinity);
            store.splitClip(clipId, -Infinity);
            // Nonexistent clip
            store.splitClip('missing-clip', 125);

            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(50);
            expect(useVideoEditorStore.getState().past.length).toBe(pastBefore);
        });

        it('refuses to split a 1-frame duration clip at any integer frame', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Single Frame Clip',
                startFrame: 50,
                durationInFrames: 1, // spans [50, 51)
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            // Any cut <= 50 or >= 51 is invalid. There is no integer between 50 and 51!
            store.splitClip(clipId, 50);
            store.splitClip(clipId, 50.4); // rounds to 50
            store.splitClip(clipId, 50.6); // rounds to 51
            store.splitClip(clipId, 51);

            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(1);
        });

        it('handles floating point split positions with Math.round and boundary rejection', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Float Test',
                startFrame: 0,
                durationInFrames: 30,
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            // 0.4 rounds to 0 -> should be rejected because splitFrame <= startFrame
            store.splitClip(clipId, 0.4);
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);

            // 29.6 rounds to 30 -> should be rejected because splitFrame >= endFrame
            store.splitClip(clipId, 29.6);
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);

            // 12.4 rounds to 12 -> valid split
            store.splitClip(clipId, 12.4);
            const clips = useVideoEditorStore.getState().project.clips;
            expect(clips).toHaveLength(2);
            expect(clips[0]!.durationInFrames).toBe(12);
            expect(clips[1]!.durationInFrames).toBe(18);
            expect(clips[1]!.startFrame).toBe(12);
        });

        it('accurately partitions 100 keyframes across multiple properties with zero timing shifts', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            // Clip spanning 200 frames from startFrame 50 to 250
            const startFrame = 50;
            const durationInFrames = 200;

            // Build 100 keyframes:
            // - opacity: 50 keyframes at frames 0, 2, 4, ..., 98 (relative to clip)
            // - scale: 30 keyframes at frames 80, 82, ..., 138
            // - volume: 20 keyframes at frames 150, 152, ..., 188
            const opacityKfs = Array.from({ length: 50 }, (_, i) => ({
                frame: i * 2, // 0..98
                value: Number((i * 0.02).toFixed(2)),
                easing: (i % 2 === 0 ? ('easeIn' as const) : ('easeOut' as const)),
            }));
            const scaleKfs = Array.from({ length: 30 }, (_, i) => ({
                frame: 80 + i * 2, // 80..138
                value: Number((1 + i * 0.05).toFixed(2)),
                easing: 'easeInOut' as const,
            }));
            const volumeKfs = Array.from({ length: 20 }, (_, i) => ({
                frame: 150 + i * 2, // 150..188
                value: Number((0.5 + i * 0.02).toFixed(2)),
                easing: 'linear' as const,
            }));

            store.addClip({
                type: 'video',
                name: 'Keyframe Heavy Clip',
                startFrame,
                durationInFrames,
                trackId: t1,
                keyframes: {
                    opacity: opacityKfs,
                    scale: scaleKfs,
                    volume: volumeKfs,
                },
            });

            const originalClip = useVideoEditorStore.getState().project.clips[0]!;
            const splitPoint = 150; // Absolute frame 150 (relative frame 100)

            // Perform split at absolute frame 150
            store.splitClip(originalClip.id, splitPoint);

            const clips = useVideoEditorStore.getState().project.clips;
            expect(clips).toHaveLength(2);
            const [left, right] = clips;

            expect(left!.startFrame).toBe(50);
            expect(left!.durationInFrames).toBe(100);
            expect(right!.startFrame).toBe(150);
            expect(right!.durationInFrames).toBe(100);

            // Check Left Keyframes:
            // opacity: all 50 keyframes had frame < 100 -> all 50 stay on left
            expect(left!.keyframes?.opacity).toHaveLength(50);
            left!.keyframes?.opacity?.forEach((kf, idx) => {
                expect(kf.frame).toBe(idx * 2);
                expect(left!.startFrame + kf.frame).toBe(startFrame + opacityKfs[idx]!.frame);
                expect(kf.value).toBe(opacityKfs[idx]!.value);
                expect(kf.easing).toBe(opacityKfs[idx]!.easing);
            });

            // scale: original had frames 80..138.
            // Split boundary is 100.
            // Keyframes < 100: 80, 82, 84, 86, 88, 90, 92, 94, 96, 98 (10 keyframes)
            expect(left!.keyframes?.scale).toHaveLength(10);
            left!.keyframes?.scale?.forEach((kf, idx) => {
                expect(kf.frame).toBe(80 + idx * 2);
                expect(left!.startFrame + kf.frame).toBe(startFrame + scaleKfs[idx]!.frame);
            });

            // volume: had frames 150..188 (none < 100). Left must have NO volume keyframes.
            expect(left!.keyframes?.volume).toBeUndefined();

            // Check Right Keyframes:
            // opacity: none >= 100 -> Right must have NO opacity keyframes.
            expect(right!.keyframes?.opacity).toBeUndefined();

            // scale: keyframes >= 100: 100, 102, ..., 138 (20 keyframes).
            // Shifted by -100: 0, 2, ..., 38.
            expect(right!.keyframes?.scale).toHaveLength(20);
            right!.keyframes?.scale?.forEach((kf, idx) => {
                const origKf = scaleKfs[10 + idx]!;
                expect(kf.frame).toBe(origKf.frame - 100);
                // ABSOLUTE TIMING CHECK:
                expect(right!.startFrame + kf.frame).toBe(startFrame + origKf.frame);
                expect(kf.value).toBe(origKf.value);
            });

            // volume: all 20 keyframes >= 100.
            // Shifted by -100: 50, 52, ..., 88.
            expect(right!.keyframes?.volume).toHaveLength(20);
            right!.keyframes?.volume?.forEach((kf, idx) => {
                const origKf = volumeKfs[idx]!;
                expect(kf.frame).toBe(origKf.frame - 100);
                // ABSOLUTE TIMING CHECK:
                expect(right!.startFrame + kf.frame).toBe(startFrame + origKf.frame);
                expect(kf.value).toBe(origKf.value);
            });

            // Selection is updated to right clip
            expect(useVideoEditorStore.getState().selectedClipId).toBe(right!.id);
        });

        it('splits clip with 0 keyframes cleanly without errors', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Zero Keyframe Clip',
                startFrame: 0,
                durationInFrames: 40,
                trackId: t1,
                // no keyframes property
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            store.splitClip(clipId, 20);

            const clips = useVideoEditorStore.getState().project.clips;
            expect(clips).toHaveLength(2);
            expect(clips[0]!.keyframes).toBeUndefined();
            expect(clips[1]!.keyframes).toBeUndefined();
        });

        it('survives a cascade of 10 consecutive splits without gap or frame drift', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Cascade Clip',
                startFrame: 0,
                durationInFrames: 1000,
                trackId: t1,
                sourceInUs: 0,
                sourceOutUs: 33_333_333,
            });

            // Cut repeatedly at 100, 200, 300, 400, 500, 600, 700, 800, 900
            for (let cut = 100; cut <= 900; cut += 100) {
                // Find the clip spanning 'cut'
                const target = useVideoEditorStore.getState().project.clips.find(
                    c => c.startFrame < cut && (c.startFrame + c.durationInFrames) > cut
                );
                expect(target).toBeDefined();
                store.splitClip(target!.id, cut);
            }

            const clips = useVideoEditorStore.getState().project.clips;
            expect(clips).toHaveLength(10);

            // Invariant: perfectly contiguous tiling
            let expectedStart = 0;
            let totalDuration = 0;
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i]!;
                expect(clip.startFrame).toBe(expectedStart);
                expect(clip.durationInFrames).toBe(100);
                totalDuration += clip.durationInFrames;
                expectedStart += clip.durationInFrames;
            }
            expect(totalDuration).toBe(1000);
        });

        it('duplicateClip isolates keyframes completely so modifying duplicate does not alter original', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Original Clip',
                startFrame: 0,
                durationInFrames: 50,
                trackId: t1,
                keyframes: {
                    scale: [{ frame: 0, value: 1 }, { frame: 25, value: 2 }],
                    volume: [{ frame: 10, value: 0.8 }],
                },
            });
            const origClipId = useVideoEditorStore.getState().project.clips[0]!.id;

            store.duplicateClip(origClipId);
            const copyClipId = useVideoEditorStore.getState().selectedClipId!;
            expect(copyClipId).not.toBe(origClipId);

            // Mutate keyframes on duplicate via moveKeyframe and addKeyframe
            store.moveKeyframe(copyClipId, 'scale', 25, 40);
            store.addKeyframe(copyClipId, 'opacity', 5, 0.3);

            // Original clip's keyframes MUST NOT have changed
            const orig = useVideoEditorStore.getState().project.clips.find(c => c.id === origClipId)!;
            expect(orig.keyframes?.scale).toEqual([{ frame: 0, value: 1 }, { frame: 25, value: 2 }]);
            expect(orig.keyframes?.opacity).toBeUndefined();
        });
    });

    // =========================================================================
    // 3. MOVEKEYFRAME COLLISIONS & ADVERSARIAL MOVEMENTS
    // =========================================================================
    describe('moveKeyframe Collisions & Adversarial Movements', () => {
        it('enforces discrete clamping on negative frames and frames exceeding clip duration', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Bounds Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: t1,
                keyframes: {
                    opacity: [{ frame: 50, value: 0.5 }],
                },
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            // Negative frame clamped to 0
            store.moveKeyframe(clipId, 'opacity', 50, -999);
            expect(useVideoEditorStore.getState().project.clips[0]!.keyframes?.opacity![0]!.frame).toBe(0);

            // Excessive frame clamped to durationInFrames (100)
            store.moveKeyframe(clipId, 'opacity', 0, 8888);
            expect(useVideoEditorStore.getState().project.clips[0]!.keyframes?.opacity![0]!.frame).toBe(100);

            // Float frame rounding: 45.4 -> 45
            store.moveKeyframe(clipId, 'opacity', 100, 45.4);
            expect(useVideoEditorStore.getState().project.clips[0]!.keyframes?.opacity![0]!.frame).toBe(45);

            // Float frame rounding: 45 -> 70.7 -> 71
            store.moveKeyframe(clipId, 'opacity', 45, 70.7);
            expect(useVideoEditorStore.getState().project.clips[0]!.keyframes?.opacity![0]!.frame).toBe(71);
        });

        it('correctly replaces destination keyframe on collision and maintains sorted order', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Collision Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: t1,
                keyframes: {
                    scale: [
                        { frame: 10, value: 1.0 },
                        { frame: 20, value: 1.5 },
                        { frame: 30, value: 2.0 },
                        { frame: 40, value: 2.5 },
                    ],
                },
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            // Move frame 10 (value 1.0) onto frame 30 (value 2.0).
            // Frame 30 must now have value 1.0; length drops from 4 to 3.
            store.moveKeyframe(clipId, 'scale', 10, 30);

            let kfs = useVideoEditorStore.getState().project.clips[0]!.keyframes!['scale'];
            expect(kfs).toHaveLength(3);
            expect(kfs).toEqual([
                { frame: 20, value: 1.5 },
                { frame: 30, value: 1.0 },
                { frame: 40, value: 2.5 },
            ]);

            // Out-of-order move: move frame 40 to frame 15 (between nothing and 20)
            store.moveKeyframe(clipId, 'scale', 40, 15);
            kfs = useVideoEditorStore.getState().project.clips[0]!.keyframes!['scale'];
            expect(kfs).toHaveLength(3);
            expect(kfs).toEqual([
                { frame: 15, value: 2.5 },
                { frame: 20, value: 1.5 },
                { frame: 30, value: 1.0 },
            ]);

            // Undo restores prior states in reverse order
            store.undo();
            kfs = useVideoEditorStore.getState().project.clips[0]!.keyframes!['scale'];
            expect(kfs).toEqual([
                { frame: 20, value: 1.5 },
                { frame: 30, value: 1.0 },
                { frame: 40, value: 2.5 },
            ]);

            store.undo(); // Undo collision
            kfs = useVideoEditorStore.getState().project.clips[0]!.keyframes!['scale'];
            expect(kfs).toEqual([
                { frame: 10, value: 1.0 },
                { frame: 20, value: 1.5 },
                { frame: 30, value: 2.0 },
                { frame: 40, value: 2.5 },
            ]);
        });

        it('no-ops when moving nonexistent keyframe or moving to identical frame without adding undo history', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'NoOp Clip',
                startFrame: 0,
                durationInFrames: 100,
                trackId: t1,
                keyframes: {
                    opacity: [{ frame: 20, value: 0.8 }],
                },
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;
            const pastCount = useVideoEditorStore.getState().past.length;

            store.moveKeyframe(clipId, 'opacity', 20, 20);
            store.moveKeyframe(clipId, 'opacity', 99, 50);
            store.moveKeyframe(clipId, 'nonexistent-prop', 20, 50);
            store.moveKeyframe('nonexistent-clip', 'opacity', 20, 50);

            expect(useVideoEditorStore.getState().past.length).toBe(pastCount);
        });
    });

    // =========================================================================
    // 4. TRANSIENT DRAG UNDO PROTECTION STRESS TESTING
    // =========================================================================
    describe('Transient Drag Undo Protection Stress Testing', () => {
        it('protects against 100 mouse moves: 0 undo entries during drag, exactly 1 on commit', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Drag Target',
                startFrame: 0,
                durationInFrames: 30,
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;

            expect(useVideoEditorStore.getState().past).toHaveLength(1); // from addClip
            useVideoEditorStore.setState({ past: [], future: [] });

            // Simulate 100 rapid 60fps drag frames
            for (let i = 1; i <= 100; i++) {
                store.updateClipTransient(clipId, { startFrame: i });

                // Invariants during active drag:
                // 1. startFrame reflects position immediately
                expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(i);
                // 2. ZERO undo history pushed
                expect(useVideoEditorStore.getState().past).toHaveLength(0);
                // 3. ZERO redo history cleared/added
                expect(useVideoEditorStore.getState().future).toHaveLength(0);
            }

            // Commit final drop at frame 100
            store.commitTransientClipUpdate(clipId, { startFrame: 100 });

            // Invariants after commit:
            // 1. Current project is at frame 100
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(100);
            // 2. Exactly ONE undo entry in past
            expect(useVideoEditorStore.getState().past).toHaveLength(1);
            // 3. The snapshot in past is the pre-drag baseline
            expect(useVideoEditorStore.getState().past[0]!.clips[0]!.startFrame).toBe(0);

            // Test Undo restores baseline directly
            store.undo();
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(0);
            expect(useVideoEditorStore.getState().future).toHaveLength(1);

            // Test Redo restores dropped state
            store.redo();
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(100);
        });

        it('aborts drag on Escape/cancel: reverts position and creates 0 undo entries', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Abort Target',
                startFrame: 10,
                durationInFrames: 30,
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;
            useVideoEditorStore.setState({ past: [], future: [] });

            // Drag 50 steps
            for (let i = 11; i <= 60; i++) {
                store.updateClipTransient(clipId, { startFrame: i });
            }
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(60);
            expect(useVideoEditorStore.getState().past).toHaveLength(0);

            // Abort (simulate Escape key)
            store.abortTransientClipUpdate();

            // Project reverted to initial startFrame: 10
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(10);
            // Past stack remains empty (0 entries)
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
        });

        it('pushes zero undo entries when dragging back to origin (zero net delta)', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Net Zero Target',
                startFrame: 15,
                durationInFrames: 30,
                trackId: t1,
            });
            const clipId = useVideoEditorStore.getState().project.clips[0]!.id;
            useVideoEditorStore.setState({ past: [], future: [] });

            // Drag away
            for (let i = 16; i <= 50; i++) {
                store.updateClipTransient(clipId, { startFrame: i });
            }
            // Drag back to 15
            for (let i = 49; i >= 15; i--) {
                store.updateClipTransient(clipId, { startFrame: i });
            }

            // Commit back at original frame 15
            store.commitTransientClipUpdate(clipId, { startFrame: 15 });

            // No net change -> 0 undo entries
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(15);
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
        });

        it('hook integration: useTimelineDrag processes high-frequency window mousemoves and commits 1 undo entry', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Hook Drag Clip',
                startFrame: 0,
                durationInFrames: 30,
                trackId: t1,
            });
            const clip = useVideoEditorStore.getState().project.clips[0]!;
            useVideoEditorStore.setState({ past: [], future: [] });

            const { result } = renderHook(() => useTimelineDrag());

            // 1. Start drag at clientX: 100
            act(() => {
                const fakeEvent = {
                    stopPropagation: () => {},
                    preventDefault: () => {},
                    clientX: 100,
                } as unknown as React.MouseEvent;
                result.current.handleDragStart(fakeEvent, clip, 'move');
            });

            expect(result.current.dragState).not.toBeNull();
            expect(useVideoEditorStore.getState().selectedClipId).toBe(clip.id);

            // 2. Dispatch 100 window mousemove events (moving rightward from 101 to 200)
            act(() => {
                for (let x = 101; x <= 200; x++) {
                    window.dispatchEvent(new MouseEvent('mousemove', { clientX: x }));
                }
            });

            // Intermediate updates must not have flooded past
            expect(useVideoEditorStore.getState().past).toHaveLength(0);

            // 3. Mouse up at clientX: 200
            // Delta X = 100px. At pxPerFrame = 2, deltaFrames = 50.
            act(() => {
                window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200 }));
            });

            // Drag finished
            expect(result.current.dragState).toBeNull();
            // Final position is 50 frames
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(50);
            // Exactly ONE undo entry in past!
            expect(useVideoEditorStore.getState().past).toHaveLength(1);

            // Undo restores initial frame 0
            act(() => {
                useVideoEditorStore.getState().undo();
            });
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(0);
        });

        it('hook integration: useTimelineDrag aborts on Escape key press with 0 undo entries', () => {
            const store = useVideoEditorStore.getState();
            const t1 = useVideoEditorStore.getState().project.tracks[0]!.id;

            store.addClip({
                type: 'video',
                name: 'Escape Clip',
                startFrame: 10,
                durationInFrames: 30,
                trackId: t1,
            });
            const clip = useVideoEditorStore.getState().project.clips[0]!;
            useVideoEditorStore.setState({ past: [], future: [] });

            const { result } = renderHook(() => useTimelineDrag());

            // 1. Start drag
            act(() => {
                const fakeEvent = {
                    stopPropagation: () => {},
                    preventDefault: () => {},
                    clientX: 50,
                } as unknown as React.MouseEvent;
                result.current.handleDragStart(fakeEvent, clip, 'move');
            });

            // 2. Move
            act(() => {
                window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
            });

            // 3. Press Escape key
            act(() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            });

            // Drag aborted
            expect(result.current.dragState).toBeNull();
            // Restored initial startFrame
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(10);
            // 0 undo entries
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
        });
    });
});
