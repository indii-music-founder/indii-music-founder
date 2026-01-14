import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AudioAnalyzer from './AudioAnalyzer';
import { useToast } from '@/core/context/ToastContext';
import React from 'react';

// --- Mocks ---

vi.mock('wavesurfer.js', () => ({
    default: {
        create: vi.fn(() => ({
            load: vi.fn(),
            on: vi.fn(),
            destroy: vi.fn(),
            registerPlugin: vi.fn(),
            getDuration: vi.fn(() => 100),
        })),
    },
}));

vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => ({
    default: {
        create: vi.fn(() => ({
            on: vi.fn(),
            addRegion: vi.fn(),
        })),
    },
}));

// MusicLibraryService removed.

vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn().mockResolvedValue({ bpm: 120, key: 'C', scale: 'major', energy: 0.5, duration: 100 }),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

// Mock AudioContext
const mockAudioContext = {
    createAnalyser: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(),
};

describe('AudioAnalyzer Interaction: Save Analysis', () => {
    const mockToast = {
        loading: vi.fn(() => 'toast-id'),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
        window.URL.createObjectURL = vi.fn(() => 'blob:mock');
        (useToast as any).mockReturnValue(mockToast);

        // Default mocks for analysis flow (MusicLibraryService removed)
    });

    it('🖱️ Click: Save Analysis (Redirected to Laboratory Testing)', async () => {
        render(<AudioAnalyzer />);

        const saveBtn = screen.getByTestId('save-analysis-button');

        // Initially disabled until file uploaded
        expect(saveBtn).toBeDisabled();

        const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });
        const input = screen.getByTestId('import-track-input');
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => expect(saveBtn).not.toBeDisabled());

        fireEvent.click(saveBtn);
        expect(mockToast.info).toHaveBeenCalledWith('Local save functionality currently in laboratory testing.');
    });
});
