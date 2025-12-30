import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus } from '../types';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
        getCampaigns: vi.fn(),
        calculateROI: vi.fn(),
    }
}));

// Mock CampaignManager as it has its own complexities
vi.mock('./CampaignManager', () => ({
    default: ({ campaign }: any) => (
        <div data-testid="campaign-manager">
            Managing: {campaign.title}
        </div>
    ),
}));

describe('CampaignDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    it('renders empty state initially', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
    });

    it('opens create campaign modal when button is clicked', () => {
        render(<CampaignDashboard />);
        fireEvent.click(screen.getByText('Create New Campaign'));
        expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });

    it('calls MarketingService.createCampaign when modal form is submitted', async () => {
        vi.mocked(MarketingService.createCampaign).mockResolvedValue('new-campaign-id');
        vi.mocked(MarketingService.getCampaignById).mockResolvedValue({
            id: 'new-campaign-id',
            title: 'Test Campaign',
            status: CampaignStatus.PENDING,
            posts: [],
            assetType: 'campaign',
            durationDays: 30,
            startDate: '2023-01-01'
        } as any);

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

    it('switches to CampaignManager view after successful creation', async () => {
        vi.mocked(MarketingService.createCampaign).mockResolvedValue('new-campaign-id');
        vi.mocked(MarketingService.getCampaignById).mockResolvedValue({
            id: 'new-campaign-id',
            title: 'Test Campaign',
            status: CampaignStatus.PENDING,
            posts: [],
            assetType: 'campaign',
            durationDays: 30,
            startDate: '2023-01-01'
        } as any);

        render(<CampaignDashboard />);

        // Open and fill modal
        fireEvent.click(screen.getByText('Create New Campaign'));
        fireEvent.change(screen.getByLabelText(/Campaign Name/i), { target: { value: 'Test Campaign' } });
        fireEvent.click(screen.getByText('Launch Campaign'));

        await waitFor(() => {
            expect(screen.getByTestId('campaign-manager')).toBeInTheDocument();
        });
    });
});
