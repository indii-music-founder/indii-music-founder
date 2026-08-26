import { beforeEach, describe, expect, it, vi } from 'vitest';

import { blankProjectForId, useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

// Un-stub the global setup's store mock: undo/redo must prove the REAL wrapper.
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

const seed = () => {
    useVideoEditorStore.setState({
        project: {
            ...blankProjectForId('proj-1'),
            clips: [
                { id: 'c1', type: 'video', startFrame: 0, durationInFrames: 30, trackId: 'track-1', name: 'Take 1', src: 'a.mp4' },
            ],
        },
        past: [],
        future: [],
        previewArtifactUrl: null,
    });
};

describe('videoEditorStore — undo/redo history', () => {
    beforeEach(seed);

    it('records every project mutation and restores the prior snapshot on undo', () => {
        const original = useVideoEditorStore.getState().project;
        useVideoEditorStore.getState().updateClip('c1', { name: 'Renamed' });

        expect(useVideoEditorStore.getState().past).toHaveLength(1);
        expect(useVideoEditorStore.getState().project.clips[0]!.name).toBe('Renamed');

        useVideoEditorStore.getState().undo();

        expect(useVideoEditorStore.getState().project).toBe(original);
        expect(useVideoEditorStore.getState().future).toHaveLength(1);
    });

    it('redo re-applies the undone edit and clears on a fresh edit', () => {
        useVideoEditorStore.getState().updateClip('c1', { name: 'Renamed' });
        useVideoEditorStore.getState().undo();
        expect(useVideoEditorStore.getState().project.clips[0]!.name).toBe('Take 1');

        useVideoEditorStore.getState().redo();
        expect(useVideoEditorStore.getState().project.clips[0]!.name).toBe('Renamed');
        expect(useVideoEditorStore.getState().past).toHaveLength(1);

        // A new edit invalidates the redo branch.
        useVideoEditorStore.getState().updateClip('c1', { name: 'Different' });
        expect(useVideoEditorStore.getState().future).toHaveLength(0);
        useVideoEditorStore.getState().redo();
        expect(useVideoEditorStore.getState().project.clips[0]!.name).toBe('Different');
    });

    it('does nothing on undo/redo at the stack edges', () => {
        useVideoEditorStore.getState().undo();
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(1);
        useVideoEditorStore.getState().redo();
        expect(useVideoEditorStore.getState().project.clips[0]!.name).toBe('Take 1');
    });

    it('caps the undo stack at the history limit', () => {
        for (let i = 0; i < 60; i += 1) {
            useVideoEditorStore.getState().updateClip('c1', { name: `Take ${i}` });
        }
        expect(useVideoEditorStore.getState().past.length).toBeLessThanOrEqual(50);
    });
});
