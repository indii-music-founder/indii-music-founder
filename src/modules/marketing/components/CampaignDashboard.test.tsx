import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus, CampaignAsset } from '../types';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
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
        subscribeToCampaigns: vi.fn(() => () => {}), // Mock subscription
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

// Mock CampaignManager as it has its own complexities
vi.mock('./CampaignManager', () => ({
    default: ({ selectedCampaign, onCreateNew }: any) => {
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
        expect(await screen.findByText('New Campaign')).toBeInTheDocument();

        // Verify accessible inputs exist
        expect(screen.getByLabelText(/Campaign Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Platform/)).toBeInTheDocument();
    });
});
