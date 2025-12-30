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
    }
}));

// Mock CampaignManager as it has its own complexities
vi.mock('./CampaignManager', () => ({
    default: ({ campaign }: any) => (
        <div data-testid="campaign-manager">
            Managing: {campaign.title}
        </div>
    ),
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
        cleanup();
    });

    it('renders empty state initially', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
        expect(screen.getByText(/Select a campaign/)).toBeInTheDocument();
    });

    it('opens create modal when clicking create button', async () => {
        render(<CampaignDashboard />);
        const createBtn = screen.getByRole('button', { name: /Create New Campaign/i });
        fireEvent.click(createBtn);

        // Wait for modal to appear
        expect(await screen.findByText('New Campaign')).toBeInTheDocument();

        // Verify accessible inputs exist
        expect(screen.getByLabelText(/Campaign Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Platform/)).toBeInTheDocument();
    });

    it('creates campaign and switches to manager view', async () => {
        const mockCampaignId = 'new-campaign-id';
        const mockCampaign = {
            id: mockCampaignId,
            title: 'My New Campaign',
            startDate: '2023-01-01',
            status: CampaignStatus.PENDING,
            posts: []
        };

        // Setup mocks
        vi.mocked(MarketingService.createCampaign).mockResolvedValue(mockCampaignId);
        vi.mocked(MarketingService.getCampaignById).mockResolvedValue(mockCampaign as any);
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
        const createBtn = screen.getByRole('button', { name: /Create New Campaign/i });
        fireEvent.click(createBtn);

        // Fill form using accessible queries
        fireEvent.change(screen.getByLabelText(/Campaign Name/), { target: { value: 'My New Campaign' } });
        fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value: '2023-01-01' } });

        // Submit
        fireEvent.click(screen.getByText('Launch Campaign'));

        // Verify API calls
        await waitFor(() => {
            expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
                title: 'My New Campaign',
                startDate: '2023-01-01'
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

        // Verify view switched to Manager
        expect(screen.getByTestId('campaign-manager')).toBeInTheDocument();
        expect(screen.getByText('Managing: My New Campaign')).toBeInTheDocument();
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
