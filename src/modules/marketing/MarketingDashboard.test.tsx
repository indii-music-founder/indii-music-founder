import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketingDashboard from './MarketingDashboard';
import { CampaignStatus } from './types';

// Mock Hook
vi.mock('./hooks/useMarketing', () => ({
    useMarketing: vi.fn()
}));
import { useMarketing } from './hooks/useMarketing';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        userProfile: { id: 'user-123' },
        currentModule: 'marketing',
        setState: vi.fn()
    }))
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })
}));

describe('MarketingDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock Return
        (useMarketing as any).mockReturnValue({
            stats: {
                totalReach: 124.5,
                engagementRate: 4.8,
                activeCampaigns: 2
            },
            campaigns: [
                {
                    id: '1',
                    title: 'Product Launch Teaser',
                    startDate: new Date().toISOString(),
                    status: CampaignStatus.EXECUTING,
                    posts: [{ platform: 'Twitter', day: new Date().getDate() }]
                }
            ],
            loading: false,
            error: null,
            createCampaign: vi.fn()
        });
    });

    it('renders the dashboard title', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Marketing Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Plan, execute, and track your campaigns.')).toBeInTheDocument();
    });

    it('renders stats from hook', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('124.5K')).toBeInTheDocument();
        expect(screen.getByText('4.8%')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders calendar grid with campaigns', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Campaign Calendar')).toBeInTheDocument();
        expect(screen.getByText('Product Launch Teaser')).toBeInTheDocument();
    });

    it('shows loading state correctly', () => {
        (useMarketing as any).mockReturnValue({
            stats: null,
            campaigns: [],
            loading: true,
            error: null
        });

        render(<MarketingDashboard />);
        expect(screen.getAllByText('...')[0]).toBeInTheDocument();
    });
});
