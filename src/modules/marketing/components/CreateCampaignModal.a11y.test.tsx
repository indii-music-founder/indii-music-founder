import React from 'react';
import { render, screen } from '@testing-library/react';
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
        (useToast as any).mockReturnValue({
            success: vi.fn(),
            error: vi.fn()
        });
    });

    it('close button should have aria-label', () => {
        render(<CreateCampaignModal onClose={vi.fn()} onSave={vi.fn()} />);
        const closeButton = screen.getByLabelText('Close modal');
        expect(closeButton).toBeInTheDocument();
    });
});
