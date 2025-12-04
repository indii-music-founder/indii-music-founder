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

        expect(screen.getByText('Audio Analysis')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('shows context state after starting engine', async () => {
        render(<MusicStudio />);

        fireEvent.click(screen.getByText('Start Audio Engine'));

        await waitFor(() => {
            expect(screen.getByText('Context State')).toBeInTheDocument();
            expect(screen.getByText('Running')).toBeInTheDocument();
        });
    });
});
