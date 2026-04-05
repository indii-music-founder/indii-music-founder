import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QCPanel } from '../QCPanel';
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
        validateReleaseMetadata: vi.fn(),
        generateContentIdAssets: vi.fn(),
    },
}));

describe('QCPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render input fields', () => {
        render(<QCPanel />);
        expect(screen.getByPlaceholderText(/Enter title/i)).toBeDefined();
        expect(screen.getByPlaceholderText(/Avoid generic names/i)).toBeDefined();
        expect(screen.getByPlaceholderText(/https/i)).toBeDefined();
    });

    it('should call validateReleaseMetadata when QC button is clicked', async () => {
        const mockReport = {
            valid: true,
            errors: [],
            warnings: [],
            summary: 'All good'
        };
        (distributionService.validateReleaseMetadata as import("vitest").Mock).mockResolvedValue(mockReport);

        render(<QCPanel />);

        // Fill inputs
        fireEvent.change(screen.getByPlaceholderText(/Enter title/i), { target: { value: 'Test Title' } });
        fireEvent.change(screen.getByPlaceholderText(/Avoid generic names/i), { target: { value: 'Test Artist' } });

        // Click Validate
        fireEvent.click(screen.getByText('Run QC'));

        await waitFor(() => {
            expect(distributionService.validateReleaseMetadata).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Title',
                artists: ['Test Artist']
            }));
        });

        // Check success state
        expect(screen.getByText('PASSED')).toBeDefined();
        expect(screen.getByText('All good')).toBeDefined();
    });

    it('should display errors when validation fails', async () => {
        const mockReport = {
            valid: false,
            errors: ['Title is too short'],
            warnings: [],
            summary: 'Validation failed'
        };
        (distributionService.validateReleaseMetadata as import("vitest").Mock).mockResolvedValue(mockReport);

        render(<QCPanel />);

        fireEvent.click(screen.getByText('Run QC'));

        await waitFor(() => {
            expect(screen.getByText('FAILED')).toBeDefined();
            expect(screen.getByText('Title is too short')).toBeDefined();
        });
    });

    it('should call generateContentIdAssets when CID button is clicked', async () => {
        (distributionService.generateContentIdAssets as import("vitest").Mock).mockResolvedValue('ISRC,Title\nUS123,Test');

        render(<QCPanel />);

        fireEvent.click(screen.getByText('Gen CID CSV'));

        await waitFor(() => {
            expect(distributionService.generateContentIdAssets).toHaveBeenCalled();
        });

        expect(screen.getByText(/US123,Test/)).toBeDefined();
    });
});
