import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';

const { mockToastError } = vi.hoisted(() => ({
    mockToastError: vi.fn(),
}));

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: mockToastError,
        info: vi.fn(),
    }),
}));

vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: vi.fn(() => ({
        campaigns: [],
        actions: {
            createCampaign: vi.fn(),
            refreshDashboard: vi.fn(),
        },
        isLoading: false,
        error: null,
    })),
}));

vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
        getCampaigns: vi.fn(),
        updateCampaign: vi.fn(),
        subscribeToCampaigns: vi.fn(() => () => { }), // Mock subscription
    }
}));

// Mock useMarketing hook
vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: () => ({
        campaigns: [],
        actions: {
            refresh: vi.fn(),
            deleteCampaign: vi.fn(),
            updateCampaign: vi.fn(),
        }
    })
}));

const TEST_CAMPAIGN = { id: 'campaign-1', title: 'Test Campaign', posts: [] };

// Mock CampaignManager as it has its own complexities
vi.mock('./CampaignManager', () => ({
    default: ({ selectedCampaign, onCreateNew, onUpdateCampaign }: any) => {
        // If selectedCampaign is present, show "Managing: Title"
        // Otherwise show list/empty state which includes "Create New Campaign" button
        if (selectedCampaign) {
            return (
                <div data-testid="campaign-manager">
                    Managing: {selectedCampaign.title}
                </div>
            );
        }
        return (
            <div>
                <div>Campaign Manager</div>
                <button onClick={onCreateNew}>Create New Campaign</button>
                <button onClick={() => { onUpdateCampaign(TEST_CAMPAIGN).catch(() => {}); }}>Trigger Update</button>
                <div>Select a campaign</div>
            </div>
        );
    },
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
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('New Campaign', { selector: 'h2' })).toBeInTheDocument();

        // Verify accessible inputs exist
        expect(screen.getByLabelText(/Campaign Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Platform/)).toBeInTheDocument();
    });

    describe('ISSUE-949: campaign updates actually persist', () => {
        it('persists an update via MarketingService.updateCampaign', async () => {
            (MarketingService.updateCampaign as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Trigger Update' }));

            await waitFor(() => {
                expect(MarketingService.updateCampaign).toHaveBeenCalledWith('campaign-1', expect.objectContaining({
                    id: 'campaign-1',
                    title: 'Test Campaign'
                }));
            });
        });

        it('surfaces an error toast and does not silently claim success when the write fails', async () => {
            (MarketingService.updateCampaign as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Firestore write failed'));

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Trigger Update' }));

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Failed to save'));
            });
        });
    });
});
