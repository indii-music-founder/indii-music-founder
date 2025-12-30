import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignAsset } from '../types';

// Mock MarketingService
vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
    }
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })
}));

describe('CampaignDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders create new campaign button when no campaign is selected', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
    });

    it('opens create campaign modal when button is clicked', () => {
        render(<CampaignDashboard />);
        fireEvent.click(screen.getByText('Create New Campaign'));
        expect(screen.getByText('New Campaign')).toBeInTheDocument(); // Modal title
    });

    it('calls MarketingService.createCampaign when modal form is submitted', async () => {
        (MarketingService.createCampaign as any).mockResolvedValue('new-campaign-id');
        (MarketingService.getCampaignById as any).mockResolvedValue({
            id: 'new-campaign-id',
            title: 'Test Campaign',
            status: 'pending',
            posts: [] // Added posts array to fix TypeError in CampaignManager
        });

        render(<CampaignDashboard />);
        fireEvent.click(screen.getByText('Create New Campaign'));

        // Fill form
        fireEvent.change(screen.getByLabelText(/Campaign Name/i), { target: { value: 'Test Campaign' } });
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2023-01-01' } });

        // Click Launch
        fireEvent.click(screen.getByText('Launch Campaign'));

        await waitFor(() => {
            expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Campaign',
                startDate: '2023-01-01'
            }));
        });
    });
});
