import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AudioAnalyzer from './AudioAnalyzer';
import { MusicLibraryService } from '../music/services/MusicLibraryService';
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

vi.mock('../music/services/MusicLibraryService', () => ({
    MusicLibraryService: {
        getTrackAnalysis: vi.fn(),
        saveTrackAnalysis: vi.fn(),
    },
}));

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
        dismiss: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
        window.URL.createObjectURL = vi.fn(() => 'blob:mock');
        (useToast as any).mockReturnValue(mockToast);

        // Default mocks for analysis flow
        vi.mocked(MusicLibraryService.getTrackAnalysis).mockResolvedValue(null);
        vi.mocked(MusicLibraryService.saveTrackAnalysis).mockResolvedValue({} as any);
    });

    it('🖱️ Click: Save Analysis Lifecycle (Idle -> Loading -> Success -> Ready)', async () => {
        render(<AudioAnalyzer />);

        const saveBtn = screen.getByTestId('save-analysis-button');

        // 1. Initial State: Disabled (no file)
        expect(saveBtn).toBeDisabled();

        // 2. Upload File to Enable Button
        const file = new File(['audio'], 'vibe-check.mp3', { type: 'audio/mpeg' });
        const input = screen.getByTestId('import-track-input');

        // Mocking direct analysis success to skip wait
        vi.mocked(MusicLibraryService.getTrackAnalysis).mockResolvedValue(null);

        fireEvent.change(input, { target: { files: [file] } });

        // Wait for analysis to finish so button enables
        await waitFor(() => expect(saveBtn).not.toBeDisabled());

        // 3. Trigger Save Lifecycle
        // Set up mock to resolve after a delay to catch loading state
        let resolveSave: (val: any) => void;
        const savePromise = new Promise((res) => { resolveSave = res; });
        vi.mocked(MusicLibraryService.saveTrackAnalysis).mockReturnValue(savePromise as any);

        fireEvent.click(saveBtn);

        // --- ASSERT: LOADING STATE ---
        // Button should disable during save
        expect(saveBtn).toBeDisabled();
        expect(mockToast.loading).toHaveBeenCalledWith('Saving Sonic DNA for vibe-check.mp3...');

        // --- ASSERT: SUCCESS EVENT ---
        resolveSave!(true);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Analysis saved to Music Library.');
        });

        // --- ASSERT: FINAL STATE (READY) ---
        // Button should be enabled again and loader dismissed
        expect(saveBtn).not.toBeDisabled();
        expect(mockToast.dismiss).toHaveBeenCalledWith('toast-id');
    });

    it('🖱️ Click: Save Analysis Failure Recovery', async () => {
        render(<AudioAnalyzer />);
        const saveBtn = screen.getByTestId('save-analysis-button');

        // Setup state to be ready to save
        const file = new File(['audio'], 'error.mp3', { type: 'audio/mpeg' });
        fireEvent.change(screen.getByTestId('import-track-input'), { target: { files: [file] } });
        await waitFor(() => expect(saveBtn).not.toBeDisabled());

        // Mock failure
        vi.mocked(MusicLibraryService.saveTrackAnalysis).mockRejectedValue(new Error('Firebase Timeout'));

        fireEvent.click(saveBtn);

        // ASSERT: ERROR FEEDBACK
        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Failed to save analysis.');
        });

        // ASSERT: RECOVERY (Ready to try again)
        expect(saveBtn).not.toBeDisabled();
        expect(mockToast.dismiss).toHaveBeenCalled();
    });
});
