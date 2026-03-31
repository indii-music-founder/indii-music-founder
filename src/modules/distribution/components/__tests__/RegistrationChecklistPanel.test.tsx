import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrationChecklistPanel } from '../RegistrationChecklistPanel';
import { distributionService } from '@/services/distribution/DistributionService';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        assignISRCs: vi.fn(),
    },
}));

// Provide a stable mock for dependencies in window
const mockElectronAPI = {
    selectFile: vi.fn(),
    audio: {
        analyze: vi.fn(),
    },
    distribution: {
        generateUPC: vi.fn(),
    }
};

describe('RegistrationChecklistPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('electronAPI', undefined);
    });

    it('should render the checklist in expanded state by default', () => {
        render(<RegistrationChecklistPanel />);
        expect(screen.getByText(/Registration Checklist/i)).toBeDefined();
        // Check for items
        expect(screen.getByTestId('checklist-item-audio')).toBeDefined();
    });

    it('should toggle expansion when header is clicked', async () => {
        render(<RegistrationChecklistPanel />);
        const toggle = screen.getByTestId('checklist-toggle');

        // Initial state
        expect(screen.getByTestId('checklist-warning-text')).toBeDefined();

        // Click to collapse
        await act(async () => {
            fireEvent.click(toggle);
        });

        // Items removed from DOM when AnimatePresence completes
        await waitFor(() => {
            expect(screen.queryByTestId('checklist-warning-text')).toBeNull();
        });
    });

    it('should complete ISRC verification when action button is clicked', async () => {
        (distributionService.assignISRCs as import("vitest").Mock).mockResolvedValue('US-XXX-25-00001');
        render(<RegistrationChecklistPanel />);

        const actionBtn = screen.getByTestId('checklist-action-isrc');
        await act(async () => {
            fireEvent.click(actionBtn);
        });

        await waitFor(() => {
            expect(distributionService.assignISRCs).toHaveBeenCalled();
        });

        expect(screen.getByText(/ISRC: US-XXX-25-00001/i)).toBeDefined();
        // Action button should disappear on completion
        expect(screen.queryByTestId('checklist-action-isrc')).toBeNull();
    });

    it('should handle audio verification via Electron API', async () => {
        vi.stubGlobal('electronAPI', mockElectronAPI);
        mockElectronAPI.selectFile.mockResolvedValue('/path/to/master.wav');
        mockElectronAPI.audio.analyze.mockResolvedValue({
            status: 'success',
            streams: [{ sample_rate: '44100', bits_per_sample: '16' }]
        });

        render(<RegistrationChecklistPanel />);

        const actionBtn = screen.getByTestId('checklist-action-audio');
        await act(async () => {
            fireEvent.click(actionBtn);
        });

        await waitFor(() => {
            expect(mockElectronAPI.selectFile).toHaveBeenCalled();
            expect(mockElectronAPI.audio.analyze).toHaveBeenCalledWith('/path/to/master.wav');
        });

        // Use a more flexible matcher if needed, but here we expect the component to update the label
        // The component logic for handleAudioVerify on success calls success toast and setItemStatus('audio', 'complete')
        // Which makes the label: "Audio Master (16-bit/44.1kHz+)" with line-through
        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Audio Master') && content.includes('16-bit'))).toBeDefined();
        }, { timeout: 2000 });
    });

    it('should show warning for non-CD quality audio', async () => {
        vi.stubGlobal('electronAPI', mockElectronAPI);
        mockElectronAPI.selectFile.mockResolvedValue('/path/to/demo.mp3');
        mockElectronAPI.audio.analyze.mockResolvedValue({
            status: 'success',
            streams: [{ sample_rate: '22050', bits_per_sample: '8' }]
        });

        render(<RegistrationChecklistPanel />);

        const actionBtn = screen.getByTestId('checklist-action-audio');
        await act(async () => {
            fireEvent.click(actionBtn);
        });

        await waitFor(() => {
            expect(screen.getByText(/Audio Master — 22.05kHz\/8-bit \(below spec\)/i)).toBeDefined();
        });
    });
});
