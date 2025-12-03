import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicStudio from './MusicStudio';
import * as Tone from 'tone';

// Mock Tone.js
vi.mock('tone', () => ({
    start: vi.fn().mockResolvedValue(undefined),
    Synth: vi.fn().mockImplementation(function () {
        return {
            toDestination: vi.fn().mockReturnThis(),
            triggerAttack: vi.fn(),
            triggerRelease: vi.fn(),
            dispose: vi.fn(),
            volume: {
                value: 0
            }
        };
    }),
    context: {
        sampleRate: 44100,
        lookAhead: 0.1
    }
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

describe('MusicStudio', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the initial start screen', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Audio Engine Not Started')).toBeInTheDocument();
        expect(screen.getByText('Start Audio Engine')).toBeInTheDocument();
    });

    it('starts the audio engine when button is clicked', async () => {
        render(<MusicStudio />);

        const startBtn = screen.getByText('Start Audio Engine');
        fireEvent.click(startBtn);

        await waitFor(() => {
            expect(Tone.start).toHaveBeenCalled();
        });

        expect(screen.getByText('Basic Synthesizer')).toBeInTheDocument();
    });

    it('initializes synth after starting engine', async () => {
        render(<MusicStudio />);

        fireEvent.click(screen.getByText('Start Audio Engine'));

        await waitFor(() => {
            expect(Tone.Synth).toHaveBeenCalled();
        });
    });

    it('toggles play state when button is clicked', async () => {
        render(<MusicStudio />);

        // Start engine first
        fireEvent.click(screen.getByText('Start Audio Engine'));
        await waitFor(() => screen.getByText('Basic Synthesizer'));

        const playButton = screen.getByTestId('play-button');

        fireEvent.click(playButton);
        expect(playButton.className).toContain('bg-red-500');

        fireEvent.click(playButton);
        expect(playButton.className).toContain('bg-green-600');
    });

    it('adjusts volume', async () => {
        render(<MusicStudio />);
        fireEvent.click(screen.getByText('Start Audio Engine'));
        await waitFor(() => screen.getByText('Basic Synthesizer'));

        const volumeSlider = screen.getByRole('slider'); // input type range
        fireEvent.change(volumeSlider, { target: { value: '-20' } });

        expect(screen.getByText('-20 dB')).toBeInTheDocument();
    });
});
