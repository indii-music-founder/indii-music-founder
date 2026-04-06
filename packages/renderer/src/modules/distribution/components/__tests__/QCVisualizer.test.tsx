import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QCVisualizer } from '../QCVisualizer';
import { distributionService } from '@/services/distribution/DistributionService';
import React from 'react';

// Mock DistributionService
vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        runLocalForensics: vi.fn(),
        updateTask: vi.fn().mockResolvedValue(undefined),
    },
}));

// Provide a stable mock for dependencies in window
const mockElectronAPI = {
    distribution: {
        runForensics: vi.fn(),
    }
};

// Mock standard UI context that's missing functions in test env
vi.mock('@/core/context/ToastContext', async () => {
    const actual = await vi.importActual('@/core/context/ToastContext');
    return {
        ...actual as any,
        useToast: () => ({
            success: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
            showToast: vi.fn(),
        }),
    };
});

const renderWithProps = (props = {}) => {
    return render(
        <QCVisualizer {...props} />
    );
};

describe('QCVisualizer', () => {
    const mockFilePath = '/path/to/audio.wav';
    const mockReport = {
        taskId: 'qc-123',
        status: 'PASS',
        details: {
            true_peak_db: '-1.5',
            estimated_lufs: '-14.0',
            mix_balance_score: 8,
            format: 'wav',
            sample_rate: 44100,
        },
        issues: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('electronAPI', undefined);
    });

    it('should render in idle state', () => {
        renderWithProps();
        expect(screen.getByText(/Distribution Gateway/i)).toBeInTheDocument();
    });

    it('should run demo mode when not in Electron', async () => {
        renderWithProps();

        const runButton = await screen.findByRole('button', { name: /Run QC \(Demo Mode\)/i });
        fireEvent.click(runButton);

        // Wait for results
        await screen.findByTestId('qc-passed-badge');
        expect(screen.getByText(/\(demo\)/i)).toBeInTheDocument();

        expect(distributionService.runLocalForensics).not.toHaveBeenCalled();
    });

    it('should run real forensics in Electron context', async () => {
        vi.stubGlobal('electronAPI', mockElectronAPI);
        vi.mocked(distributionService.runLocalForensics).mockResolvedValue(mockReport as any);

        renderWithProps({ initialFilePath: mockFilePath });

        const runButton = await screen.findByRole('button', { name: /Run Audio QC Analysis/i });
        fireEvent.click(runButton);

        await waitFor(() => {
            expect(distributionService.runLocalForensics).toHaveBeenCalled();
        }, { timeout: 2000 });

        await screen.findByTestId('qc-passed-badge');
        await screen.findByRole('button', { name: /Execute Delivery/i });
    });

    it('should handle QC failures', async () => {
        vi.stubGlobal('electronAPI', mockElectronAPI);
        const failReport = {
            ...mockReport,
            status: 'FAIL',
            details: { ...mockReport.details, true_peak_db: '+0.5' },
            issues: ['True peak exceeds DSP ceiling'],
        };
        vi.mocked(distributionService.runLocalForensics).mockResolvedValue(failReport as any);

        renderWithProps({ initialFilePath: mockFilePath });

        const runButton = await screen.findByRole('button', { name: /Run Audio QC Analysis/i });
        fireEvent.click(runButton);

        // Failures show 'Block Delivery' and specific FAIL badges
        await screen.findByText(/Block Delivery/i);
        expect(screen.getAllByText(/FAIL/i).length).toBeGreaterThan(0);
    });

    it('should reset state on reset action', async () => {
        vi.stubGlobal('electronAPI', mockElectronAPI);
        vi.mocked(distributionService.runLocalForensics).mockResolvedValue(mockReport as any);

        renderWithProps({ initialFilePath: mockFilePath });

        const runButton = await screen.findByRole('button', { name: /Run Audio QC Analysis/i });
        fireEvent.click(runButton);

        await screen.findByTestId('qc-passed-badge');

        const resetButton = await screen.findByRole('button', { name: /Reset QC/i });
        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(screen.queryByTestId('qc-passed-badge')).not.toBeInTheDocument();
        });

        expect(screen.getByText(/Drop audio file here/i)).toBeInTheDocument();
    });
});
