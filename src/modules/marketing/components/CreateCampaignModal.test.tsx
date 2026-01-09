import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingService } from '@/services/marketing/MarketingService';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        createCampaign: vi.fn(),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

describe('CreateCampaignModal Interaction', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useToast).mockReturnValue({
            success: mockToastSuccess,
            error: mockToastError,
            showToast: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
            loading: vi.fn(),
            dismiss: vi.fn(),
            updateProgress: vi.fn(),
            promise: vi.fn(),
        });
    });

    it('should handle the full success lifecycle: Idle -> Loading -> Success', async () => {
        // Setup
        let resolveCreate: (value: string) => void;
        const createPromise = new Promise<string>((resolve) => {
            resolveCreate = resolve;
        });
        vi.mocked(MarketingService.createCampaign).mockReturnValue(createPromise);

        render(<CreateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // 1. Fill Form
        fireEvent.change(screen.getByTestId('campaign-title-input'), {
            target: { value: 'Test Campaign' },
        });
        fireEvent.change(screen.getByTestId('campaign-start-date-input'), {
            target: { value: '2023-10-01' },
        });

        // 2. Click Submit
        const submitBtn = screen.getByTestId('create-campaign-submit-btn');
        fireEvent.click(submitBtn);

        // 3. Assert Loading State
        expect(submitBtn).toBeDisabled();
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        expect(screen.getByText('Creating...')).toBeInTheDocument();

        // 4. Resolve Promise (Simulate API Success)
        await act(async () => {
            resolveCreate!('new-campaign-id');
        });

        // 5. Assert Success State
        expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Test Campaign',
            startDate: '2023-10-01',
        }));
        expect(mockToastSuccess).toHaveBeenCalledWith('Campaign created successfully!');
        expect(mockOnSave).toHaveBeenCalledWith('new-campaign-id');
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle error lifecycle: Idle -> Loading -> Error -> Idle', async () => {
        // Setup
        let rejectCreate: (reason?: any) => void;
        const createPromise = new Promise<string>((_, reject) => {
            rejectCreate = reject;
        });
        vi.mocked(MarketingService.createCampaign).mockReturnValue(createPromise);

        render(<CreateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // 1. Fill Form
        fireEvent.change(screen.getByTestId('campaign-title-input'), {
            target: { value: 'Fail Campaign' },
        });

        // 2. Click Submit
        const submitBtn = screen.getByTestId('create-campaign-submit-btn');
        fireEvent.click(submitBtn);

        // 3. Assert Loading State
        expect(submitBtn).toBeDisabled();

        // 4. Reject Promise (Simulate API Error)
        await act(async () => {
            rejectCreate!(new Error('API Error'));
        });

        // 5. Assert Error State
        expect(mockToastError).toHaveBeenCalledWith('Failed to create campaign');
        expect(submitBtn).not.toBeDisabled();
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
        expect(screen.getByText('Launch Campaign')).toBeInTheDocument();
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should prevent submission and show inline error if required fields are missing', async () => {
        render(<CreateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // 1. Clear default start date (default is today) and title (empty)
        fireEvent.change(screen.getByTestId('campaign-start-date-input'), {
            target: { value: '' },
        });

        // 2. Click Submit without Title
        const submitBtn = screen.getByTestId('create-campaign-submit-btn');
        fireEvent.click(submitBtn);

        // 3. Assert Validation Feedback
        expect(MarketingService.createCampaign).not.toHaveBeenCalled();

        // Removed generic toast expectation in favor of inline check
        // expect(mockToastError).toHaveBeenCalledWith('Please fill in required fields');

        // Check for inline error messages (which I added in the implementation)
        expect(screen.getByText('Campaign name is required')).toBeInTheDocument();
        expect(screen.getByText('Start date is required')).toBeInTheDocument();

        expect(submitBtn).not.toBeDisabled();
    });
});
