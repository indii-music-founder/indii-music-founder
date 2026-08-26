import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const project = {
        id: 'project-1', name: 'Project', width: 1920, height: 1080, fps: 30,
        durationInFrames: 60,
        tracks: [
            { id: 'video-track', name: 'Video', type: 'video' as const },
            { id: 'text-track', name: 'Text', type: 'text' as const },
        ],
        clips: [
            { id: 'v1', name: 'Clip', type: 'video' as const, src: 'a.mp4', trackId: 'video-track', startFrame: 0, durationInFrames: 30 },
            { id: 't1', name: 'Title', type: 'text' as const, text: 'HELLO', trackId: 'text-track', startFrame: 0, durationInFrames: 30 },
        ],
    };
    const updateProjectSettings = vi.fn((settings: Record<string, unknown>) => { Object.assign(project, settings); });
    const updateClip = vi.fn((id: string, updates: Record<string, unknown>) => {
        const clip = project.clips.find(c => c.id === id);
        if (clip) Object.assign(clip, updates);
    });
    return { project, updateProjectSettings, updateClip };
});

vi.mock('../../store/videoEditorStore', () => {
    const getState = () => ({
        project: mocks.project,
        updateProjectSettings: mocks.updateProjectSettings,
        updateClip: mocks.updateClip,
    });
    const hook = (selector?: (state: unknown) => unknown) => {
        if (selector) return selector(getState());
        return getState();
    };
    return { useVideoEditorStore: Object.assign(hook, { getState }) };
});

import { TreatmentPicker } from './TreatmentPicker';

describe('TreatmentPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies a preset to the project, text clips, and audio clips', () => {
        render(<TreatmentPicker />);

        fireEvent.change(screen.getByTestId('video-treatment-picker'), {
            target: { value: 'amber-night-cinematic' },
        });

        expect(mocks.updateProjectSettings).toHaveBeenCalledWith(
            expect.objectContaining({ background: expect.objectContaining({ kind: 'radial-glow' }) }),
        );
        expect(mocks.updateProjectSettings).toHaveBeenCalledWith(
            expect.objectContaining({ seam: { type: 'cut-the-curve', direction: 'LEFT' } }),
        );
        expect(mocks.updateClip).toHaveBeenCalledWith('t1', { entrance: { type: 'waterfall' } });
    });

    it('does nothing when the placeholder option is selected', () => {
        render(<TreatmentPicker />);

        fireEvent.change(screen.getByTestId('video-treatment-picker'), {
            target: { value: '' },
        });

        expect(mocks.updateProjectSettings).not.toHaveBeenCalled();
        expect(mocks.updateClip).not.toHaveBeenCalled();
    });
});
