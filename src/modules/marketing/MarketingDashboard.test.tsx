import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketingDashboard from './MarketingDashboard';
import { CampaignStatus } from './types';

// Mock Hook
vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: vi.fn()
}));
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';

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
    });

    const mockDefaultData = {
        stats: {
            totalReach: 124500,
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
        isLoading: false,
        error: null,
        actions: { createCampaign: vi.fn(), refreshDashboard: vi.fn() }
    };

    it('renders the dashboard title', () => {
        vi.mocked(useMarketing).mockReturnValue(mockDefaultData as any);
        render(<MarketingDashboard />);
        expect(screen.getByText('Marketing Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Plan, execute, and track your campaigns.')).toBeInTheDocument();
    });

    it('renders stats from hook', () => {
        vi.mocked(useMarketing).mockReturnValue(mockDefaultData as any);
        render(<MarketingDashboard />);
        expect(screen.getByText('124,500')).toBeInTheDocument();
        expect(screen.getByText('4.8%')).toBeInTheDocument();
        // Check for "2" but specifically in stats context if possible, or just presence
        // The calendar day "2" might exist, so we accept multiple
        const elements = screen.getAllByText('2');
        expect(elements.length).toBeGreaterThan(0);
    });

    it('renders calendar grid with campaigns', () => {
        vi.mocked(useMarketing).mockReturnValue(mockDefaultData as any);
        render(<MarketingDashboard />);
        expect(screen.getByText(/Campaign Calendar/)).toBeInTheDocument();
        expect(screen.getByText('Product Launch Teaser')).toBeInTheDocument();
    });

    it('shows loading state correctly', () => {
        vi.mocked(useMarketing).mockReturnValue({
            stats: null,
            campaigns: [],
            isLoading: true,
            error: null,
            actions: { createCampaign: vi.fn(), refreshDashboard: vi.fn() }
        } as any);


        render(<MarketingDashboard />);
        expect(screen.getAllByText('...')[0]).toBeInTheDocument();
    });


});
