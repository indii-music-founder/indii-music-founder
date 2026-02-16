import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaignDashboard from './CampaignDashboard';

// Mock dependencies
const mockUseMarketing = vi.fn();
vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: () => mockUseMarketing(),
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));

// Mock child components to isolate the dashboard logic
vi.mock('./MarketingSidebar', () => ({
    MarketingSidebar: () => <div data-testid="marketing-sidebar" />
}));
vi.mock('./MarketingToolbar', () => ({
    MarketingToolbar: () => <div data-testid="marketing-toolbar" />
}));

describe('CampaignDashboard Pulse (Loading States)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading state while fetching campaigns', () => {
        // Arrange: Loading is true, no campaigns
        mockUseMarketing.mockReturnValue({
            campaigns: [],
            stats: {},
            isLoading: true, // Pulse: This is key
            error: null,
            actions: {}
        });

        // Act
        render(<CampaignDashboard />);

        // Assert: We expect a loader
        expect(screen.getByTestId('marketing-dashboard-loader')).toBeInTheDocument();

        // And we shouldn't see "Active Campaigns"
        expect(screen.queryByText('Active Campaigns')).not.toBeInTheDocument();
    });

    it('shows the campaign list when loading completes', () => {
        // Arrange: Loading is false, data present
        mockUseMarketing.mockReturnValue({
            campaigns: [{ id: '1', title: 'Test Campaign', startDate: '2023-01-01', posts: [] }],
            stats: {},
            isLoading: false,
            error: null,
            actions: {}
        });

        // Act
        render(<CampaignDashboard />);

        // Assert
        expect(screen.queryByTestId('marketing-dashboard-loader')).not.toBeInTheDocument();
        expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
    });
});
