import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketingDashboard from './MarketingDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus } from './types';

// Mock Services
vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getMarketingStats: vi.fn(),
        getCampaigns: vi.fn()
    }
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        userProfile: { id: 'user-123' }
    }))
}));

// Mock Toast
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

describe('MarketingDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (MarketingService.getMarketingStats as any).mockResolvedValue({
            totalReach: 124.5,
            engagementRate: 4.8,
            activeCampaigns: 2
        });
        (MarketingService.getCampaigns as any).mockResolvedValue([
            {
                id: '1',
                title: 'Product Launch Teaser',
                startDate: new Date().toISOString(),
                status: CampaignStatus.EXECUTING,
                posts: [{ platform: 'Twitter', day: new Date().getDate() }]
            }
        ]);
    });

    it('renders the dashboard title', async () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Marketing Dashboard')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('Plan, execute, and track your campaigns.')).toBeInTheDocument();
        });
    });

    it('renders stats', async () => {
        render(<MarketingDashboard />);
        // Initially might show loading "..." if implemented as in the code I wrote
        // Let's wait for the real data
        await waitFor(() => {
            expect(screen.getByText('124.5K')).toBeInTheDocument();
            expect(screen.getByText('4.8%')).toBeInTheDocument();
        });
    });

    it('renders calendar grid with campaigns', async () => {
        render(<MarketingDashboard />);
        await waitFor(() => {
            expect(screen.getByText('Campaign Calendar')).toBeInTheDocument();
            expect(screen.getByText('Product Launch Teaser')).toBeInTheDocument();
        });
    });
});
