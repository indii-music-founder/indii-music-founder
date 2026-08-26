import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VideoClip } from '../../store/videoEditorStore';
import { TreatmentSection } from './VideoPropertySections';

vi.mock('../../store/videoEditorStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/videoEditorStore')>();
    return {
        ...actual,
        useVideoEditorStore: vi.fn((selector?: (state: unknown) => unknown) => {
            const state = { currentTime: 10 };
            return selector ? selector(state) : state;
        }),
    };
});

describe('TreatmentSection', () => {
    const updateClip = vi.fn();

    const textClip: VideoClip = {
        id: 'clip-1', type: 'text', name: 'Title', text: 'HELLO',
        trackId: 't2', startFrame: 0, durationInFrames: 60,
    };
    const videoClip: VideoClip = {
        id: 'clip-2', type: 'video', name: 'Clip', src: 'a.mp4',
        trackId: 't1', startFrame: 0, durationInFrames: 60,
    };
    const audioClip: VideoClip = {
        id: 'clip-3', type: 'audio', name: 'Bed', src: 'bed.mp3',
        trackId: 't3', startFrame: 0, durationInFrames: 60,
    };

    const openSection = () => {
        fireEvent.click(screen.getByText('Treatment'));
    };
    const entranceSelect = () => screen.getByTestId('treatment-entrance') as HTMLSelectElement;

    beforeEach(() => {
        updateClip.mockClear();
    });

    it('offers waterfall + inverse-zoom entrances for text clips and applies them', () => {
        render(<TreatmentSection selectedClip={textClip} updateClip={updateClip} />);
        openSection();

        const select = entranceSelect();
        expect(select.querySelector('option[value="waterfall"]')).not.toBeNull();
        expect(select.querySelector('option[value="inverse-zoom"]')).not.toBeNull();

        fireEvent.change(select, { target: { value: 'waterfall' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { entrance: { type: 'waterfall' } });

        fireEvent.change(select, { target: { value: 'inverse-zoom' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { entrance: { type: 'inverse-zoom' } });
    });

    it('only offers inverse-zoom (no waterfall) for video clips', () => {
        render(<TreatmentSection selectedClip={videoClip} updateClip={updateClip} />);
        openSection();

        const select = entranceSelect();
        expect(select.querySelector('option[value="waterfall"]')).toBeNull();
        fireEvent.change(select, { target: { value: 'inverse-zoom' } });
        expect(updateClip).toHaveBeenCalledWith('clip-2', { entrance: { type: 'inverse-zoom' } });
    });

    it('toggles a count-up and clears any conflicting waterfall entrance', () => {
        const withWaterfall = { ...textClip, entrance: { type: 'waterfall' as const } };
        render(<TreatmentSection selectedClip={withWaterfall} updateClip={updateClip} />);
        openSection();

        fireEvent.click(screen.getByTestId('treatment-countup-toggle'));
        expect(updateClip).toHaveBeenCalledWith('clip-1', {
            countUp: { to: 10, suffix: '' },
            entrance: undefined,
        });
    });

    it('edits count-up target and suffix', () => {
        const counting = { ...textClip, countUp: { to: 4, suffix: ' AGENTS' } };
        render(<TreatmentSection selectedClip={counting} updateClip={updateClip} />);
        openSection();

        fireEvent.change(screen.getByTestId('treatment-countup-to'), { target: { value: '9' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { countUp: { to: 9, suffix: ' AGENTS' } });

        fireEvent.change(screen.getByTestId('treatment-countup-suffix'), { target: { value: ' STREAMS' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { countUp: { to: 4, suffix: ' STREAMS' } });
    });

    it('writes audio fades for audio-bearing clips and treats non-positive as off', () => {
        render(<TreatmentSection selectedClip={audioClip} updateClip={updateClip} />);
        openSection();

        fireEvent.change(screen.getByTestId('treatment-fade-in'), { target: { value: '1.5' } });
        expect(updateClip).toHaveBeenCalledWith('clip-3', { audioFade: { inSeconds: 1.5 } });

        fireEvent.change(screen.getByTestId('treatment-fade-out'), { target: { value: '0' } });
        expect(updateClip).toHaveBeenCalledWith('clip-3', { audioFade: { outSeconds: undefined } });
    });

    it('shows no entrance controls for audio clips but keeps fades', () => {
        render(<TreatmentSection selectedClip={audioClip} updateClip={updateClip} />);
        openSection();

        expect(screen.queryByTestId('treatment-entrance')).toBeNull();
        expect(screen.getByTestId('treatment-fade-in')).toBeInTheDocument();
    });
});
