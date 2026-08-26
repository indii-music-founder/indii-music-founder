import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VideoClip } from '../../store/videoEditorStore';
import { ClipBasicsSection, ContentSection } from './VideoPropertySections';

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

describe('ContentSection — professional text controls', () => {
    const updateClip = vi.fn();
    const textClip: VideoClip = {
        id: 'clip-1', type: 'text', name: 'Title', text: 'Out Now',
        trackId: 't2', startFrame: 0, durationInFrames: 60,
    };

    beforeEach(() => {
        updateClip.mockClear();
    });

    it('applies an embedded font family, case, and letter spacing', () => {
        render(<ContentSection selectedClip={textClip} updateClip={updateClip} />);

        fireEvent.change(screen.getByTestId('text-font-family'), { target: { value: 'Space Mono' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { fontFamily: 'Space Mono' });

        fireEvent.change(screen.getByTestId('text-case'), { target: { value: 'uppercase' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { textCase: 'uppercase' });

        fireEvent.change(screen.getByTestId('text-letter-spacing'), { target: { value: '0.08' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', { letterSpacing: 0.08 });
    });

    it('toggles a caption panel with a default dark fill and recolors it', () => {
        render(<ContentSection selectedClip={textClip} updateClip={updateClip} />);

        fireEvent.click(screen.getByTestId('text-background-toggle'));
        expect(updateClip).toHaveBeenCalledWith('clip-1', { textBackground: { color: '#000000', padding: 12, radius: 8 } });
    });

    it('toggles a legibility shadow and edits its blur', () => {
        const withShadow = { ...textClip, textShadow: { color: 'rgba(0,0,0,0.65)', blur: 8, offsetX: 0, offsetY: 3 } };
        render(<ContentSection selectedClip={withShadow} updateClip={updateClip} />);

        fireEvent.change(screen.getByTestId('text-shadow-blur'), { target: { value: '16' } });
        expect(updateClip).toHaveBeenCalledWith('clip-1', {
            textShadow: { color: 'rgba(0,0,0,0.65)', blur: 16, offsetX: 0, offsetY: 3 },
        });

        fireEvent.click(screen.getByTestId('text-shadow-toggle'));
        expect(updateClip).toHaveBeenCalledWith('clip-1', { textShadow: undefined });
    });
});

describe('ClipBasicsSection — speed control', () => {
    const updateClip = vi.fn();
    const videoClip: VideoClip = {
        id: 'clip-2', type: 'video', name: 'Clip', src: 'a.mp4',
        trackId: 't1', startFrame: 0, durationInFrames: 60,
    };

    beforeEach(() => {
        updateClip.mockClear();
    });

    it('clamps playback rate to the 0.25–4× render-safe range', () => {
        render(<ClipBasicsSection selectedClip={videoClip} updateClip={updateClip} />);

        fireEvent.change(screen.getByTestId('clip-playback-rate'), { target: { value: '9' } });
        expect(updateClip).toHaveBeenCalledWith('clip-2', { playbackRate: 4 });

        fireEvent.change(screen.getByTestId('clip-playback-rate'), { target: { value: '0.1' } });
        expect(updateClip).toHaveBeenCalledWith('clip-2', { playbackRate: 0.25 });

        fireEvent.change(screen.getByTestId('clip-playback-rate'), { target: { value: '1.5' } });
        expect(updateClip).toHaveBeenCalledWith('clip-2', { playbackRate: 1.5 });
    });

    it('does not show speed controls for text clips', () => {
        const textClip: VideoClip = {
            id: 'clip-3', type: 'text', name: 'Title', text: 'X',
            trackId: 't2', startFrame: 0, durationInFrames: 60,
        };
        render(<ClipBasicsSection selectedClip={textClip} updateClip={updateClip} />);
        expect(screen.queryByTestId('clip-playback-rate')).toBeNull();
    });
});
