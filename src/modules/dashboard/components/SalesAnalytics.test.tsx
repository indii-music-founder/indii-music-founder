import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SalesAnalytics from './SalesAnalytics';
import { DashboardService } from '@/services/dashboard/DashboardService';
import { AnalyticsService } from '@/services/dashboard/AnalyticsService';
import { vi } from 'vitest';
import { SalesAnalyticsData } from '@/services/dashboard/schema';

// Mock DashboardService
vi.mock('@/services/dashboard/DashboardService', () => ({
    DashboardService: {
        getCurrentUserId: vi.fn().mockReturnValue('test-user')
    }
}));

// Mock AnalyticsService
vi.mock('@/services/dashboard/AnalyticsService', () => ({
    AnalyticsService: {
        subscribeToSalesAnalytics: vi.fn()
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
        // Subscription never calls back — loading state persists
        (AnalyticsService.subscribeToSalesAnalytics as any).mockImplementation(() => vi.fn());
        const { container } = render(<SalesAnalytics />);
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('renders data after fetch', async () => {
        (AnalyticsService.subscribeToSalesAnalytics as any).mockImplementation(
            (_userId: string, onData: (data: SalesAnalyticsData) => void) => {
                onData(mockData);
                return vi.fn();
            }
        );
        const { container } = render(<SalesAnalytics />);

        await waitFor(() => {
            expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Sales Analytics')).toBeInTheDocument();
        expect(screen.getByText('5.0%')).toBeInTheDocument();
        expect(screen.getByText('1k')).toBeInTheDocument();
        expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('renders error state on failure', async () => {
        (AnalyticsService.subscribeToSalesAnalytics as any).mockImplementation(
            (_userId: string, _onData: unknown, onError: (err: Error) => void) => {
                onError(new Error('Fetch failed'));
                return vi.fn();
            }
        );
        render(<SalesAnalytics />);

        await waitFor(() => {
            expect(screen.getByText('Failed to sync sales analytics.')).toBeInTheDocument();
        });
    });

    it('refetches on retry click', async () => {
        let callCount = 0;
        (AnalyticsService.subscribeToSalesAnalytics as any).mockImplementation(
            (_userId: string, onData: (data: SalesAnalyticsData) => void, onError: (err: Error) => void) => {
                callCount++;
                if (callCount === 1) {
                    onError(new Error('Fetch failed'));
                } else {
                    onData(mockData);
                }
                return vi.fn();
            }
        );

        render(<SalesAnalytics />);

        await waitFor(() => {
            expect(screen.getByText('Failed to sync sales analytics.')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Retry'));

        await waitFor(() => {
            expect(screen.getByText('5.0%')).toBeInTheDocument();
        });
    });
});
