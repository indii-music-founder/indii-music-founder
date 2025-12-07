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
    Player: vi.fn().mockImplementation(function () {
        return {
            toDestination: vi.fn().mockReturnThis(),
            load: vi.fn().mockResolvedValue(undefined),
            start: vi.fn(),
            stop: vi.fn(),
            dispose: vi.fn(),
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

// Mock FileSystemService
vi.mock('@/services/FileSystemService', () => ({
    fileSystemService: {
        isSupported: vi.fn().mockReturnValue(true),
        listSavedHandles: vi.fn().mockResolvedValue([]),
        pickAudioFile: vi.fn().mockResolvedValue(null),
        pickDirectory: vi.fn().mockResolvedValue(null),
        getAudioFilesFromDirectory: vi.fn().mockResolvedValue([]),
        saveDirectoryHandle: vi.fn().mockResolvedValue(undefined),
        getSavedDirectoryHandle: vi.fn().mockResolvedValue(null),
        removeSavedHandle: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('MusicStudio', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the three-column layout', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Local Music Library')).toBeInTheDocument();
        expect(screen.getByText(/Loaded Tracks/)).toBeInTheDocument();
        expect(screen.getByText('Audio Engine')).toBeInTheDocument();
    });

    it('shows file/folder buttons when FS API is supported', () => {
        render(<MusicStudio />);
        expect(screen.getByText('File')).toBeInTheDocument();
        expect(screen.getByText('Folder')).toBeInTheDocument();
    });

    it('shows privacy notice', () => {
        render(<MusicStudio />);
        expect(screen.getByText(/Files stay on your device/)).toBeInTheDocument();
    });

    it('shows start engine button when not started', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Start Engine')).toBeInTheDocument();
    });

    it('starts the audio engine when button is clicked', async () => {
        render(<MusicStudio />);

        const startBtn = screen.getByText('Start Engine');
        fireEvent.click(startBtn);

        await waitFor(() => {
            expect(Tone.start).toHaveBeenCalled();
        });
    });

    it('shows running state after starting engine', async () => {
        render(<MusicStudio />);

        fireEvent.click(screen.getByText('Start Engine'));

        await waitFor(() => {
            expect(screen.getByText('State')).toBeInTheDocument();
            expect(screen.getByText('Running')).toBeInTheDocument();
        });
    });

    it('shows sample rate after starting engine', async () => {
        render(<MusicStudio />);

        fireEvent.click(screen.getByText('Start Engine'));

        await waitFor(() => {
            expect(screen.getByText('Sample Rate')).toBeInTheDocument();
            expect(screen.getByText('44100 Hz')).toBeInTheDocument();
        });
    });

    it('shows empty tracks message when no audio loaded', () => {
        render(<MusicStudio />);
        expect(screen.getByText('No audio loaded')).toBeInTheDocument();
    });
});

describe('MusicStudio File System Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls pickAudioFile when File button is clicked', async () => {
        const { fileSystemService } = await import('@/services/FileSystemService');

        render(<MusicStudio />);
        fireEvent.click(screen.getByText('File'));

        await waitFor(() => {
            expect(fileSystemService.pickAudioFile).toHaveBeenCalled();
        });
    });

    it('calls pickDirectory when Folder button is clicked', async () => {
        const { fileSystemService } = await import('@/services/FileSystemService');

        render(<MusicStudio />);
        fireEvent.click(screen.getByText('Folder'));

        await waitFor(() => {
            expect(fileSystemService.pickDirectory).toHaveBeenCalled();
        });
    });

    it('shows unsupported message when FS API not available', async () => {
        const { fileSystemService } = await import('@/services/FileSystemService');
        vi.mocked(fileSystemService.isSupported).mockReturnValue(false);

        render(<MusicStudio />);

        expect(screen.getByText(/File System Access API not supported/)).toBeInTheDocument();
    });
});
