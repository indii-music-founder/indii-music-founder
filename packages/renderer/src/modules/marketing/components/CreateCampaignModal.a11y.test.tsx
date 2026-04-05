import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateCampaignModal from './CreateCampaignModal';
import { useToast } from '@/core/context/ToastContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn()
}));

vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        createCampaign: vi.fn()
    }
}));

describe('CreateCampaignModal Accessibility', () => {
    beforeEach(() => {
        vi.mocked(useToast).mockReturnValue({
            success: vi.fn(),
            error: vi.fn(),
            showToast: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
            loading: vi.fn(),
            dismiss: vi.fn(),
            updateProgress: vi.fn(),
            promise: vi.fn()
        });
    });

    it('close button should have aria-label', () => {
        render(<CreateCampaignModal onClose={vi.fn()} onSave={vi.fn()} />);
        const closeButton = screen.getByLabelText('Close modal');
        expect(closeButton).toBeInTheDocument();
    });

    it('should close on escape key press', () => {
        const onClose = vi.fn();
        render(<CreateCampaignModal onClose={onClose} onSave={vi.fn()} />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('should close on backdrop click', () => {
        const onClose = vi.fn();
        render(<CreateCampaignModal onClose={onClose} onSave={vi.fn()} />);

        const dialog = screen.getByRole('dialog');
        fireEvent.click(dialog);
        expect(onClose).toHaveBeenCalled();
    });

    it('should not close when clicking content', () => {
        const onClose = vi.fn();
        render(<CreateCampaignModal onClose={onClose} onSave={vi.fn()} />);

        const heading = screen.getByRole('heading', { name: /New Campaign/i });
        fireEvent.click(heading);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('should have correct aria attributes', () => {
        render(<CreateCampaignModal onClose={vi.fn()} onSave={vi.fn()} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('should focus the first input on mount', () => {
        render(<CreateCampaignModal onClose={vi.fn()} onSave={vi.fn()} />);
        const input = screen.getByLabelText(/Campaign Name/i);
        expect(input).toHaveFocus();
    });
});
