import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoEditorStore } from './store/videoEditorStore';
import { act } from '@testing-library/react';

const INITIAL_STATE = useVideoEditorStore.getState();

describe('The Anarchist Ⓐ', () => {
    beforeEach(() => {
        act(() => {
            useVideoEditorStore.setState(INITIAL_STATE, true);
        });
    });

    it('Scenario: The Riot (Input Chaos) - handles malformed numeric data', () => {
        const store = useVideoEditorStore.getState();

        // Attempt to add a clip with NaN/Infinity
        // The store logic heavily types inputs as 'number' but JS allows NaN.
        // We want to verify it doesn't crash the store itself.

        try {
            act(() => {
                useVideoEditorStore.getState().addClip({
                    type: 'video',
                    name: 'Chaos Clip',
                    startFrame: NaN, // Invalid
                    durationInFrames: -50, // Impossible negative duration
                    trackId: 'track-1',
                });
            });
        } catch (e) {
            // If it throws, that's arguably acceptable, but ideally it should handle it.
            // For now, we assert that the app state is not corrupted (e.g., project.clips is still an array)
        }

        const clips = useVideoEditorStore.getState().project.clips;
        const chaosClip = clips.find(c => c.name === 'Chaos Clip');

        // It likely added it. The test passes if the Store didn't explode.
        expect(Array.isArray(clips)).toBe(true);

        if (chaosClip) {
            // If it added it, let's see if we can still operate
            act(() => {
                useVideoEditorStore.getState().removeClip(chaosClip.id);
            });
            expect(useVideoEditorStore.getState().project.clips).not.toContain(chaosClip);
        }
    });

    it('Scenario: The Squatter (Permission Defiance) - handles missing resources', () => {
        // Attempt to update a clip that doesn't exist (Ghost ID)
        const ghostId = 'phantom-clip-id';

        act(() => {
            useVideoEditorStore.getState().updateClip(ghostId, {
                startFrame: 50
            });
        });

        // Verify: No clips should be affected.
        // If logic was "find index -> update at index", index -1 might cause issues.
        // Map based update (c.id === id ? ... : c) is safe.
        const clips = useVideoEditorStore.getState().project.clips;
        expect(clips.length).toBe(1); // Default clip only
        expect(clips[0].startFrame).toBe(0); // Unchanged
    });

    it('Scenario: The Mutiny (State Rebellion) - survives impossible states', () => {
        // Force the store into "Completed" state but with NULL job data
        act(() => {
            useVideoEditorStore.setState({
                status: 'completed',
                jobId: null,
                // videoUrl is undefined
            });
        });

        const state = useVideoEditorStore.getState();
        expect(state.status).toBe('completed');

        // Now try to trigger an action while in this zombie state
        act(() => {
            state.setStatus('idle');
        });

        expect(useVideoEditorStore.getState().status).toBe('idle');
    });
});
