import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicStudio from './MusicStudio';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-ignore
        ...actual,
        Activity: () => <div data-testid="icon-activity" />,
        Music: () => <div data-testid="icon-music" />,
        Zap: () => <div data-testid="icon-zap" />,
        Fingerprint: () => <div data-testid="icon-fingerprint" />,
    };
});

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock NativeFileSystemService
vi.mock('@/services/NativeFileSystemService', () => ({
    nativeFileSystemService: {
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

// Mock AudioAnalysisService
vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyzeBuffer: vi.fn().mockResolvedValue({
            duration: 120,
            bpm: 128,
            key: 'C Major',
            energy: 0.8,
            danceability: 0.9,
            loudness: -5,
            waveform: new Float32Array(100),
        }),
    },
}));

describe('MusicStudio Analysis Dashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the new Music Analysis header', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Music Analysis')).toBeInTheDocument();
        expect(screen.getByText('Metadata & Rights Management')).toBeInTheDocument();
    });

    it('renders the core metrics cards', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Metadata Health')).toBeInTheDocument();
        expect(screen.getByText('Acoustic Fingerprint')).toBeInTheDocument();
        expect(screen.getByText('Global Rights')).toBeInTheDocument();
    });

    it('shows file integration options', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Import File')).toBeInTheDocument();
        expect(screen.getByText('Scan Folder')).toBeInTheDocument();
    });

    it('shows empty state initially', () => {
        render(<MusicStudio />);
        expect(screen.getByText('Drop Audio Files Here')).toBeInTheDocument();
        expect(screen.getByText('Drag and drop audio files to begin analysis')).toBeInTheDocument();
    });

    it('handles interaction with import buttons', async () => {
        const { nativeFileSystemService } = await import('@/services/NativeFileSystemService');
        render(<MusicStudio />);

        const importBtn = screen.getByText('Import File');
        fireEvent.click(importBtn);

        await waitFor(() => {
            expect(nativeFileSystemService.pickAudioFile).toHaveBeenCalled();
        });
    });
});
