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
        useVideoEditorStore.setState({ past: [], future: [] });
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

    it('invalidates a rendered preview when the project changes', () => {
        const store = useVideoEditorStore.getState();
        store.setPreviewArtifactUrl('file:///tmp/rendered.mp4');
        expect(useVideoEditorStore.getState().previewArtifactUrl).toBe('file:///tmp/rendered.mp4');

        store.updateProjectSettings({ durationInFrames: 450 });
        expect(useVideoEditorStore.getState().previewArtifactUrl).toBeNull();
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

    describe('Track management and actions (Milestone 1)', () => {
        it('supports adding an image track type', () => {
            const store = useVideoEditorStore.getState();
            store.addTrack('image');
            const track = useVideoEditorStore.getState().project.tracks.at(-1);
            expect(track).toBeDefined();
            expect(track?.type).toBe('image');
            expect(track?.name).toBe('image Track');
            expect(track?.isLocked).toBe(false);
            expect(track?.isSolo).toBe(false);
            expect(track?.isMuted).toBe(false);
        });

        it('toggles track mute state and records undo history', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'Track 1', type: 'audio' }],
                clips: [],
            });
            useVideoEditorStore.setState({ past: [], future: [] });

            expect(useVideoEditorStore.getState().past).toHaveLength(0);
            store.toggleMuteTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isMuted).toBe(true);
            expect(useVideoEditorStore.getState().past).toHaveLength(1);

            store.toggleMuteTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isMuted).toBe(false);
            expect(useVideoEditorStore.getState().past).toHaveLength(2);

            // Invalid track ID does not mutate or add to past
            store.toggleMuteTrack('non-existent');
            expect(useVideoEditorStore.getState().past).toHaveLength(2);
        });

        it('toggles track solo state', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'Track 1', type: 'video' }],
                clips: [],
            });

            store.toggleSoloTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isSolo).toBe(true);

            store.toggleSoloTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isSolo).toBe(false);
        });

        it('toggles track lock state and clears selectedClipId if clip is on locked track', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [
                    { id: 't1', name: 'Track 1', type: 'video' },
                    { id: 't2', name: 'Track 2', type: 'audio' },
                ],
                clips: [
                    { id: 'c1', name: 'Clip 1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 },
                    { id: 'c2', name: 'Clip 2', type: 'audio', trackId: 't2', startFrame: 0, durationInFrames: 30 },
                ],
            });

            // Select clip c1
            store.setSelectedClipId('c1');
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c1');

            // Locking t1 clears selection for c1
            store.toggleLockTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isLocked).toBe(true);
            expect(useVideoEditorStore.getState().selectedClipId).toBeNull();

            // Select clip c2 (on track t2)
            store.setSelectedClipId('c2');
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c2');

            // Unlocking t1 does not affect selection on t2
            store.toggleLockTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks[0]?.isLocked).toBe(false);
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c2');
        });

        it('reorders tracks by index correctly with boundary guards', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [
                    { id: 't0', name: 'Track 0', type: 'video' },
                    { id: 't1', name: 'Track 1', type: 'video' },
                    { id: 't2', name: 'Track 2', type: 'audio' },
                ],
                clips: [],
            });

            // Move index 0 to index 2: [t0, t1, t2] -> [t1, t2, t0]
            store.reorderTracks(0, 2);
            const tracks = useVideoEditorStore.getState().project.tracks;
            expect(tracks.map(t => t.id)).toEqual(['t1', 't2', 't0']);

            // Out-of-bounds or same index are no-ops
            const pastCount = useVideoEditorStore.getState().past.length;
            store.reorderTracks(-1, 1);
            store.reorderTracks(0, 5);
            store.reorderTracks(1, 1);
            expect(useVideoEditorStore.getState().past.length).toBe(pastCount);
        });

        it('moves track by trackId to targetIndex', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [
                    { id: 't0', name: 'Track 0', type: 'video' },
                    { id: 't1', name: 'Track 1', type: 'video' },
                    { id: 't2', name: 'Track 2', type: 'audio' },
                ],
                clips: [],
            });

            // Move t2 to index 0: [t0, t1, t2] -> [t2, t0, t1]
            store.moveTrack('t2', 0);
            expect(useVideoEditorStore.getState().project.tracks.map(t => t.id)).toEqual(['t2', 't0', 't1']);

            // Invalid ID is a no-op
            store.moveTrack('unknown', 1);
            expect(useVideoEditorStore.getState().project.tracks.map(t => t.id)).toEqual(['t2', 't0', 't1']);
        });

        it('removeTrack cleans up selectedClipId if the deleted track contained the selected clip', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [
                    { id: 't1', name: 'Track 1', type: 'video' },
                    { id: 't2', name: 'Track 2', type: 'audio' },
                ],
                clips: [
                    { id: 'c1', name: 'Clip 1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 },
                    { id: 'c2', name: 'Clip 2', type: 'audio', trackId: 't2', startFrame: 0, durationInFrames: 30 },
                ],
            });

            // Case A: Selected clip is on the track being deleted
            store.setSelectedClipId('c1');
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c1');

            store.removeTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
            expect(useVideoEditorStore.getState().selectedClipId).toBeNull();
        });

        it('removeTrack preserves selectedClipId if the deleted track did not contain the selected clip', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [
                    { id: 't1', name: 'Track 1', type: 'video' },
                    { id: 't2', name: 'Track 2', type: 'audio' },
                ],
                clips: [
                    { id: 'c1', name: 'Clip 1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 },
                    { id: 'c2', name: 'Clip 2', type: 'audio', trackId: 't2', startFrame: 0, durationInFrames: 30 },
                ],
            });

            // Case B: Selected clip is on t2, but t1 is deleted
            store.setSelectedClipId('c2');
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c2');

            store.removeTrack('t1');
            expect(useVideoEditorStore.getState().project.tracks).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips[0]?.id).toBe('c2');
            expect(useVideoEditorStore.getState().selectedClipId).toBe('c2');
        });
    });

    describe('moveKeyframe action (Milestone 1)', () => {
        it('moves keyframes with boundary clamping, collision replacement, and undo support', () => {
            const { result } = renderHook(() => useVideoEditorStore());

            act(() => {
                result.current.addClip({
                    type: 'video',
                    name: 'Keyframe Clip',
                    startFrame: 0,
                    durationInFrames: 100,
                    trackId: 'track-1'
                });
            });

            const clipId = result.current.project.clips[0]!.id;

            // 1. Setup initial keyframes (including volume)
            act(() => {
                result.current.addKeyframe(clipId, 'volume', 10, 0.5);
                result.current.addKeyframe(clipId, 'volume', 40, 0.8);
            });

            expect(result.current.project.clips[0]!.keyframes?.volume).toHaveLength(2);

            // 2. Standard movement
            act(() => {
                result.current.moveKeyframe(clipId, 'volume', 10, 25);
            });

            const movedKeys = result.current.project.clips[0]!.keyframes?.volume;
            expect(movedKeys).toHaveLength(2);
            expect(movedKeys![0]).toEqual({ frame: 25, value: 0.5 });
            expect(movedKeys![1]).toEqual({ frame: 40, value: 0.8 });

            // 3. Boundary clamping (negative frame clamped to 0)
            act(() => {
                result.current.moveKeyframe(clipId, 'volume', 25, -15);
            });
            expect(result.current.project.clips[0]!.keyframes?.volume![0]!.frame).toBe(0);

            // 4. Boundary clamping (excessive frame clamped to durationInFrames: 100)
            act(() => {
                result.current.moveKeyframe(clipId, 'volume', 0, 500);
            });
            expect(result.current.project.clips[0]!.keyframes?.volume![1]!.frame).toBe(100);

            // 5. Collision replacement (moving frame 40 onto frame 100 overwrites destination)
            act(() => {
                result.current.moveKeyframe(clipId, 'volume', 40, 100);
            });
            const postCollision = result.current.project.clips[0]!.keyframes?.volume;
            expect(postCollision).toHaveLength(1);
            expect(postCollision![0]).toEqual({ frame: 100, value: 0.8 });

            // 6. Undo / Redo restores moved keyframes
            act(() => {
                result.current.undo();
            });
            expect(result.current.project.clips[0]!.keyframes?.volume).toHaveLength(2);
            expect(result.current.project.clips[0]!.keyframes?.volume![0]!.frame).toBe(40);

            act(() => {
                result.current.redo();
            });
            expect(result.current.project.clips[0]!.keyframes?.volume).toHaveLength(1);
            expect(result.current.project.clips[0]!.keyframes?.volume![0]!.frame).toBe(100);

            // 7. No-op guards (same frame or nonexistent keyframe)
            const pastLengthBefore = result.current.past.length;
            act(() => {
                result.current.moveKeyframe(clipId, 'volume', 100, 100);
                result.current.moveKeyframe(clipId, 'volume', 999, 50);
                result.current.moveKeyframe('nonexistent-clip', 'volume', 10, 20);
            });
            expect(result.current.past.length).toBe(pastLengthBefore);
        });
    });

    describe('Transient drag and undo protection (Milestone 1)', () => {
        it('does not push undo history during updateClipTransient', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'T1', type: 'video' }],
                clips: [{ id: 'c1', name: 'C1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 }],
            });
            useVideoEditorStore.setState({ past: [], future: [] });

            store.updateClipTransient('c1', { startFrame: 5 });
            store.updateClipTransient('c1', { startFrame: 10 });
            store.updateClipTransient('c1', { startFrame: 15 });

            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(15);
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
            expect(useVideoEditorStore.getState().future).toHaveLength(0);
        });

        it('commits single undo transaction on commitTransientClipUpdate with pre-drag snapshot', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'T1', type: 'video' }],
                clips: [{ id: 'c1', name: 'C1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 }],
            });
            useVideoEditorStore.setState({ past: [], future: [] });
            const preDragProject = useVideoEditorStore.getState().project;

            store.updateClipTransient('c1', { startFrame: 5 });
            store.updateClipTransient('c1', { startFrame: 10 });
            store.commitTransientClipUpdate('c1', { startFrame: 15 });

            // Exactly one undo entry
            expect(useVideoEditorStore.getState().past).toHaveLength(1);
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(15);

            // Undo restores pre-drag position
            store.undo();
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(0);
            expect(useVideoEditorStore.getState().project).toBe(preDragProject);

            // Redo restores final dragged position
            store.redo();
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(15);
        });

        it('does not push undo history if commitTransientClipUpdate results in no net change', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'T1', type: 'video' }],
                clips: [{ id: 'c1', name: 'C1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 }],
            });
            useVideoEditorStore.setState({ past: [], future: [] });

            store.updateClipTransient('c1', { startFrame: 10 });
            // Dragged back to original frame
            store.commitTransientClipUpdate('c1', { startFrame: 0 });

            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(0);
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
        });

        it('aborts transient drag and restores initial project without undo history', () => {
            const store = useVideoEditorStore.getState();
            store.setProject({
                id: 'p1',
                name: 'P1',
                fps: 30,
                durationInFrames: 300,
                width: 1920,
                height: 1080,
                tracks: [{ id: 't1', name: 'T1', type: 'video' }],
                clips: [{ id: 'c1', name: 'C1', type: 'video', trackId: 't1', startFrame: 0, durationInFrames: 30 }],
            });
            useVideoEditorStore.setState({ past: [], future: [] });

            store.updateClipTransient('c1', { startFrame: 20 });
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(20);

            store.abortTransientClipUpdate();
            expect(useVideoEditorStore.getState().project.clips[0]!.startFrame).toBe(0);
            expect(useVideoEditorStore.getState().past).toHaveLength(0);
        });
    });
});
