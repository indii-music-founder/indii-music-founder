import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarningsDashboard } from './EarningsDashboard';
import { useFinance } from '../hooks/useFinance';

// Mock the hook
vi.mock('../hooks/useFinance');

// Mock child components
vi.mock('./RevenueChart', () => ({
    RevenueChart: () => <div data-testid="revenue-chart">Revenue Chart</div>
}));
vi.mock('./EarningsTable', () => ({
    EarningsTable: () => <div data-testid="earnings-table">Earnings Table</div>
}));

// Helper to mock hook return value
const mockUseFinance = (overrides: any = {}) => {
    (useFinance as any).mockReturnValue({
        earningsSummary: null,
        earningsLoading: false,
        earningsError: null,
        actions: { loadEarnings: vi.fn() },
        ...overrides
    });
};

describe('EarningsDashboard UI States', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state correctly', () => {
        mockUseFinance({ earningsLoading: true });
        render(<EarningsDashboard />);

        expect(screen.getByText('Loading earnings data...')).toBeInTheDocument();
        // Ensure content is hidden
        expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    });

    it('renders error state correctly', () => {
        mockUseFinance({ earningsError: 'Network Error' });
        render(<EarningsDashboard />);

        expect(screen.getByText('Error: Network Error')).toBeInTheDocument();
        // Ensure content is hidden
        expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    });

    it('renders empty state when no data is available', () => {
        mockUseFinance({ earningsSummary: null, earningsLoading: false, earningsError: null });
        render(<EarningsDashboard />);

        expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('renders success state with overview data', () => {
        const mockData = {
            totalNetRevenue: 1234.56,
            totalStreams: 5000,
            byPlatform: [{ platformName: 'Spotify', revenue: 1000 }],
            byTerritory: [{ territoryName: 'United States', territoryCode: 'US', revenue: 500 }],
            byRelease: []
        };

        mockUseFinance({
            earningsSummary: mockData,
            earningsLoading: false
        });

        render(<EarningsDashboard />);

        // Verify Header
        expect(screen.getByText('Earnings & Royalties')).toBeInTheDocument();

        // Verify Key Metrics
        // Note: toFixed(2) does not add commas, so we expect $1234.56
        expect(screen.getByText('$1234.56')).toBeInTheDocument();
        expect(screen.getByText('5,000')).toBeInTheDocument();

        // Verify Charts/Lists
        expect(screen.getByTestId('revenue-chart')).toBeInTheDocument();
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('US')).toBeInTheDocument();
        expect(screen.getByText('+$500')).toBeInTheDocument();
    });
});
