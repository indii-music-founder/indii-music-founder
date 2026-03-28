import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QCVisualizer } from '../QCVisualizer';
import { distributionService } from '@/services/distribution/DistributionService';
import { ToastProvider } from '@/core/context/ToastContext';

// Mock DistributionService
vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        runLocalForensics: vi.fn(),
    },
}));

const renderWithToast = (ui: React.ReactElement) => {
    return render(
        <ToastProvider>
            {ui}
        </ToastProvider>
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
        // Simulate Electron context by default
        (window as any).electronAPI = {};
    });

    it('should render in idle state', () => {
        renderWithToast(<QCVisualizer />);
        expect(screen.getByText('Distribution Delivery Gateway')).toBeInTheDocument();
        expect(screen.getByText(/Drop audio file here/i)).toBeInTheDocument();
    });

    it('should run demo mode when not in Electron', async () => {
        (window as any).electronAPI = undefined;
        renderWithToast(<QCVisualizer />);

        const runButton = document.getElementById('qc-run-button');
        expect(runButton).toHaveTextContent(/Run QC \(Demo Mode\)/i);
        fireEvent.click(runButton!);

        // Multiple "Analyzing" text (badge + button state), verify it appears
        await waitFor(() => {
            expect(screen.getAllByText(/Analyzing/i).length).toBeGreaterThan(0);
        });

        await waitFor(() => {
            expect(screen.getByText(/Cleared for Delivery/i)).toBeInTheDocument();
            expect(screen.getByText('(demo)')).toBeInTheDocument();
        }, { timeout: 3000 });

        expect(distributionService.runLocalForensics).not.toHaveBeenCalled();
    });

    it('should run real forensics in Electron context', async () => {
        (window as any).electronAPI = { isElectron: true };
        (distributionService.runLocalForensics as any).mockResolvedValueOnce(mockReport);

        renderWithToast(<QCVisualizer initialFilePath={mockFilePath} />);

        const runButton = document.getElementById('qc-run-button');
        expect(runButton).toHaveTextContent(/Run Audio QC Analysis/i);
        fireEvent.click(runButton!);

        await waitFor(() => {
            expect(distributionService.runLocalForensics).toHaveBeenCalledWith(
                expect.stringContaining('qc-'),
                mockFilePath
            );
            expect(screen.getByText(/Cleared for Delivery/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        // Check if individual rows are rendered
        expect(screen.getByText('Audio True Peak')).toBeInTheDocument();
        expect(screen.getByText('-1.5 dBTP')).toBeInTheDocument();
    });

    it('should handle QC failures', async () => {
        (window as any).electronAPI = { isElectron: true };
        const failReport = {
            ...mockReport,
            status: 'FAIL',
            details: {
                ...mockReport.details,
                true_peak_db: '+0.5',
            },
            issues: ['True peak exceeds DSP ceiling'],
        };
        (distributionService.runLocalForensics as any).mockResolvedValueOnce(failReport);

        renderWithToast(<QCVisualizer initialFilePath={mockFilePath} />);

        const runButton = document.getElementById('qc-run-button');
        fireEvent.click(runButton!);

        await waitFor(() => {
            expect(screen.getByText(/Delivery Blocked/i)).toBeInTheDocument();
            expect(screen.getByText('Above ceiling')).toBeInTheDocument();
            expect(screen.getByText('FAIL')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('should reset state on close/reset action', async () => {
        (window as any).electronAPI = { isElectron: true };
        (distributionService.runLocalForensics as any).mockResolvedValueOnce(mockReport);
        renderWithToast(<QCVisualizer initialFilePath={mockFilePath} />);

        const runButton = document.getElementById('qc-run-button');
        fireEvent.click(runButton!);
        await waitFor(() => screen.getByText(/Cleared for Delivery/i), { timeout: 3000 });

        const resetButton = screen.getByLabelText(/Reset QC/i);
        fireEvent.click(resetButton);

        expect(screen.queryByText(/Cleared for Delivery/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Drop audio file here/i)).toBeInTheDocument();
    });
});
