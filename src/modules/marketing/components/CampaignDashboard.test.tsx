import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';

// Mock MarketingService
vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
        getCampaigns: vi.fn(),
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

// Mock Store if needed (CampaignDashboard doesn't seem to use it directly, but MarketingService does)
// Since we mocked MarketingService, we might not need to mock store for it,
// but checking CampaignDashboard imports... it imports CampaignManager which might use store?
// It imports CampaignAsset from ../types.
// It uses CreateCampaignModal.

describe('CampaignDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state with Create New Campaign button', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
    });

    it('opens modal when Create New Campaign button is clicked', () => {
        render(<CampaignDashboard />);

        fireEvent.click(screen.getByText('Create New Campaign'));

        expect(screen.getByText('New Campaign')).toBeInTheDocument(); // Modal title
    });

    it('calls MarketingService.createCampaign when modal is submitted', async () => {
        (MarketingService.createCampaign as any).mockResolvedValue('new-campaign-id');
        (MarketingService.getCampaignById as any).mockResolvedValue({
            id: 'new-campaign-id',
            title: 'Test Campaign',
            status: 'pending',
            posts: []
        });

        render(<CampaignDashboard />);

        // Open modal
        fireEvent.click(screen.getByText('Create New Campaign'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('e.g., Summer Single Release'), { target: { value: 'Test Campaign' } });
        fireEvent.change(screen.getByPlaceholderText('Brief overview of the campaign...'), { target: { value: 'Description' } });
        // Start date is pre-filled, but let's ensure it's set

        // Submit
        fireEvent.click(screen.getByText('Launch Campaign'));

        await waitFor(() => {
            expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Campaign',
                description: 'Description'
            }));
        });
    });

    it('updates state to show campaign manager after creation', async () => {
         (MarketingService.createCampaign as any).mockResolvedValue('new-campaign-id');
        (MarketingService.getCampaignById as any).mockResolvedValue({
            id: 'new-campaign-id',
            title: 'Test Campaign',
            status: 'pending',
            posts: []
        });

        render(<CampaignDashboard />);

        // Open modal
        fireEvent.click(screen.getByText('Create New Campaign'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('e.g., Summer Single Release'), { target: { value: 'Test Campaign' } });

        // Submit
        fireEvent.click(screen.getByText('Launch Campaign'));

        await waitFor(() => {
             // After creation, CampaignDashboard calls getCampaignById and sets selectedCampaign
             // Which switches the view to CampaignManager
             // CampaignManager should render the campaign title?
             // Let's assume CampaignManager renders the title.
             // We need to check what CampaignManager renders.
             // But simpler: "Create New Campaign" button should disappear.
             expect(screen.queryByText('Create New Campaign')).not.toBeInTheDocument();
             expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
        });
    });
});
