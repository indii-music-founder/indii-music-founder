import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignAsset, CampaignStatus } from '../types';

// Mock MarketingService
vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaigns: vi.fn(),
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
    },
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('CampaignDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the empty state with Create Campaign button', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
    });

    it('opens the create modal when button is clicked', () => {
        render(<CampaignDashboard />);
        fireEvent.click(screen.getByText('Create New Campaign'));
        expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });

    it('calls createCampaign and updates state on successful creation', async () => {
        const mockCampaignId = 'new-campaign-id';
        const mockCampaign: CampaignAsset = {
            id: mockCampaignId,
            title: 'Test Campaign',
            status: CampaignStatus.PENDING,
            assetType: 'campaign',
            durationDays: 30,
            startDate: new Date().toISOString().split('T')[0],
            posts: []
        };

        (MarketingService.createCampaign as any).mockResolvedValue(mockCampaignId);
        (MarketingService.getCampaignById as any).mockResolvedValue(mockCampaign);

        render(<CampaignDashboard />);

        // Open modal
        fireEvent.click(screen.getByText('Create New Campaign'));

        // Fill form using placeholders and display values for now
        fireEvent.change(screen.getByPlaceholderText('e.g., Summer Single Release'), {
            target: { value: 'Test Campaign' },
        });

        // Click launch
        fireEvent.click(screen.getByText('Launch Campaign'));

        await waitFor(() => {
            expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Campaign',
                assetType: 'campaign',
            }));
        });

        await waitFor(() => {
             expect(MarketingService.getCampaignById).toHaveBeenCalledWith(mockCampaignId);
        });

        // Verify dashboard switched to manager view (title of campaign should appear)
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();

        // With empty posts, isDone is true, so it shows "Campaign Finished"
        expect(screen.getByText((content, element) => {
             return element?.textContent?.includes('Campaign Finished') ?? false;
        })).toBeInTheDocument();
    });
});
