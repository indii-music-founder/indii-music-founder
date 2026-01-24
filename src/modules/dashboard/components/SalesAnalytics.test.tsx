import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SalesAnalytics from './SalesAnalytics';
import { DashboardService } from '@/services/dashboard/DashboardService';
import { vi } from 'vitest';
import { SalesAnalyticsData } from '@/services/dashboard/schema';

// Mock DashboardService
vi.mock('@/services/dashboard/DashboardService', () => ({
    DashboardService: {
        getSalesAnalytics: vi.fn()
    }
}));

const mockData: SalesAnalyticsData = {
    conversionRate: { value: 5.0, change: 1.0, trend: 'up', formatted: '5.0%' },
    totalVisitors: { value: 1000, change: 10, trend: 'up', formatted: '1k' },
    clickRate: { value: 20.0, change: 0, trend: 'neutral', formatted: '20%' },
    avgOrderValue: { value: 50.00, change: -5, trend: 'down', formatted: '$50.00' },
    revenueChart: [10, 20, 30],
    period: '30d'
};

describe('SalesAnalytics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially', () => {
        (DashboardService.getSalesAnalytics as any).mockReturnValue(new Promise(() => {})); // Never resolves
        render(<SalesAnalytics />);
        expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    });

    it('renders data after fetch', async () => {
        (DashboardService.getSalesAnalytics as any).mockResolvedValue(mockData);
        render(<SalesAnalytics />);

        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Sales Analytics')).toBeInTheDocument();
        expect(screen.getByText('5.0%')).toBeInTheDocument();
        expect(screen.getByText('1k')).toBeInTheDocument();
        expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('renders error state on failure', async () => {
        (DashboardService.getSalesAnalytics as any).mockRejectedValue(new Error('Fetch failed'));
        render(<SalesAnalytics />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load sales analytics.')).toBeInTheDocument();
        });
    });

    it('refetches on retry click', async () => {
        (DashboardService.getSalesAnalytics as any)
            .mockRejectedValueOnce(new Error('Fetch failed'))
            .mockResolvedValueOnce(mockData);

        render(<SalesAnalytics />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load sales analytics.')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Retry'));

        await waitFor(() => {
            expect(screen.getByText('5.0%')).toBeInTheDocument();
        });
    });
});
