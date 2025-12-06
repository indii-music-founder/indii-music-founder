import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoEditorStore } from './store/videoEditorStore';
import { act } from '@testing-library/react';

const INITIAL_STATE = useVideoEditorStore.getState();

describe('The Director 🎬', () => {
    beforeEach(() => {
        // Reset store before each test
        act(() => {
            useVideoEditorStore.setState(INITIAL_STATE, true);
        });
    });

    it('Scenario: The Rough Cut - manages a busy timeline', () => {
        const store = useVideoEditorStore.getState();

        // 1. Add multiple clips (The "Dailies")
        const clipsToAdd = 10;
        act(() => {
            for (let i = 0; i < clipsToAdd; i++) {
                useVideoEditorStore.getState().addClip({
                    type: 'video',
                    name: `Clip ${i}`,
                    startFrame: i * 30,
                    durationInFrames: 30,
                    trackId: 'track-1',
                    src: `http://video-${i}.mp4`
                });
            }
        });

        // Verify all 10 clips added + default initial clip
        // Initial project has 1 clip.
        let currentClips = useVideoEditorStore.getState().project.clips;
        expect(currentClips.length).toBe(clipsToAdd + 1);

        // 2. Perform "The Editor's Cut" (Reordering / Moving)
        // Move the last added clip to the beginning (Time 0)
        const lastClip = currentClips[currentClips.length - 1];
        act(() => {
            useVideoEditorStore.getState().updateClip(lastClip.id, {
                startFrame: 0,
                trackId: 'track-2' // Move to different track to avoid overlap logic (if any)
            });
        });

        const updatedLastClip = useVideoEditorStore.getState().project.clips.find(c => c.id === lastClip.id);
        expect(updatedLastClip?.startFrame).toBe(0);
        expect(updatedLastClip?.trackId).toBe('track-2');

        // 3. "Kill your darlings" (Deletion)
        // Remove 5 clips
        const clipsToRemove = currentClips.slice(1, 6); // Skip default clip
        act(() => {
            clipsToRemove.forEach(clip => {
                useVideoEditorStore.getState().removeClip(clip.id);
            });
        });

        currentClips = useVideoEditorStore.getState().project.clips;
        expect(currentClips.length).toBe(clipsToAdd + 1 - 5);
    });

    it('Scenario: Timeline Durability - handles track management', () => {
        // 1. Add a new track
        act(() => {
            useVideoEditorStore.getState().addTrack('audio');
        });

        let tracks = useVideoEditorStore.getState().project.tracks;
        const newTrack = tracks.find(t => t.type === 'audio' && t.name === 'audio Track');
        expect(newTrack).toBeDefined();

        // 2. Add clip to that track
        act(() => {
            useVideoEditorStore.getState().addClip({
                type: 'audio',
                name: 'SFX',
                startFrame: 100,
                durationInFrames: 20,
                trackId: newTrack!.id,
                src: 'sfx.mp3'
            });
        });

        // 3. Delete the track
        act(() => {
            useVideoEditorStore.getState().removeTrack(newTrack!.id);
        });

        // Verify track AND its clips are gone
        tracks = useVideoEditorStore.getState().project.tracks;
        const clips = useVideoEditorStore.getState().project.clips;

        expect(tracks.find(t => t.id === newTrack!.id)).toBeUndefined();
        expect(clips.find(c => c.trackId === newTrack!.id)).toBeUndefined();
    });

    // Note: Undo/Redo is not currently implemented in the store, so that scenario is omitted for now.
    // Ideally, we would use a library like 'zundo' to add temporal capabilities.
});
