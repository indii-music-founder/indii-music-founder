import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const project = {
        id: 'project-1', name: 'Project', width: 1920, height: 1080, fps: 30,
        durationInFrames: 60,
        treatmentPresetId: undefined as string | undefined,
        background: undefined as Record<string, unknown> | undefined,
        seam: undefined as Record<string, unknown> | undefined,
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
        mocks.project.treatmentPresetId = undefined;
        mocks.project.background = undefined;
        mocks.project.seam = undefined;
        for (const clip of mocks.project.clips) {
            delete (clip as { entrance?: unknown }).entrance;
            delete (clip as { audioFade?: unknown }).audioFade;
        }
    });

    it('applies a preset to the project, text clips, and audio clips', () => {
        render(<TreatmentPicker />);

        fireEvent.change(screen.getByTestId('video-treatment-picker'), {
            target: { value: 'amber-night-cinematic' },
        });

        expect(mocks.updateProjectSettings).toHaveBeenCalledOnce();
        expect(mocks.updateProjectSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                treatmentPresetId: 'amber-night-cinematic',
                background: expect.objectContaining({ kind: 'radial-glow' }),
                seam: { type: 'cut-the-curve', direction: 'LEFT' },
                clips: expect.arrayContaining([
                    expect.objectContaining({ id: 't1', entrance: { type: 'waterfall' } }),
                ]),
            }),
        );
        expect(mocks.updateClip).not.toHaveBeenCalled();
    });

    it('does nothing when the placeholder option is selected', () => {
        render(<TreatmentPicker />);

        fireEvent.change(screen.getByTestId('video-treatment-picker'), {
            target: { value: '' },
        });

        expect(mocks.updateProjectSettings).not.toHaveBeenCalled();
        expect(mocks.updateClip).not.toHaveBeenCalled();
    });

    it('shows the applied preset from persisted project state after rerender', () => {
        const { rerender } = render(<TreatmentPicker />);
        fireEvent.change(screen.getByTestId('video-treatment-picker'), {
            target: { value: 'vinyl-warm' },
        });

        rerender(<TreatmentPicker />);

        expect(screen.getByTestId('video-treatment-picker')).toHaveValue('vinyl-warm');
        expect(mocks.updateProjectSettings).toHaveBeenCalledWith(
            expect.objectContaining({ treatmentPresetId: 'vinyl-warm' }),
        );
    });
});
