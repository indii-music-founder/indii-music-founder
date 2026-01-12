import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MerchDashboard from '../MerchDashboard';
import { useMerchandise } from '../hooks/useMerchandise';
import { MerchProduct } from '../types';
import { BrowserRouter } from 'react-router-dom';

// Mock the hook
vi.mock('../hooks/useMerchandise', () => ({
    useMerchandise: vi.fn(),
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { id: 'test-user', displayName: 'Test User' }
    })
}));

describe('Merchandise Dashboard', () => {
    const mockProducts: MerchProduct[] = [
        { id: '1', userId: 'user-1', title: 'Kill Tee', image: 'img.jpg', price: '$25.00', category: 'standard', createdAt: new Date() },
        { id: '2', userId: 'user-1', title: 'Killer Cap', image: 'cap.jpg', price: '$15.00', category: 'standard', createdAt: new Date() }
    ];

    const topSellingProducts = [
        { id: '3', userId: 'user-1', title: 'Viral Hoodie', image: 'hoodie.jpg', price: '$45.00', category: 'pro', revenue: 5000, units: 120, createdAt: new Date() },
        { id: '4', userId: 'user-1', title: 'Elite Bottle', image: 'bottle.jpg', price: '$35.00', category: 'pro', revenue: 3000, units: 85, createdAt: new Date() }
    ];

    const defaultMockReturn = {
        products: mockProducts,
        standardProducts: mockProducts,
        proProducts: [] as MerchProduct[],
        catalog: [],
        stats: { totalRevenue: 3250, unitsSold: 150, conversionRate: 5.2, revenueChange: 12, unitsChange: 8 },
        topSellingProducts: topSellingProducts,
        loading: false,
        error: null as string | null,
        addProduct: vi.fn(),
        deleteProduct: vi.fn(),
        createFromCatalog: vi.fn()
    };

    it('renders MerchDashboard with products', () => {
        vi.mocked(useMerchandise).mockReturnValue(defaultMockReturn as any);

        render(
            <BrowserRouter>
                <MerchDashboard />
            </BrowserRouter>
        );

        expect(screen.getByTestId('merch-dashboard-content')).toBeInTheDocument();
        expect(screen.getByText('Kill Tee')).toBeInTheDocument();
        expect(screen.getByText('Killer Cap')).toBeInTheDocument();
        // Check for formatted revenue if applicable, or just check if it renders
    });

    it('shows loading state', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            loading: true,
            products: []
        } as any);

        render(
            <BrowserRouter>
                <MerchDashboard />
            </BrowserRouter>
        );

        // MerchDashboard uses a loader when loading is true
        expect(screen.queryByTestId('merch-dashboard-content')).not.toBeInTheDocument();
    });

    it('shows error state', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            error: 'Failed to fetch',
            loading: false
        } as any);

        render(
            <BrowserRouter>
                <MerchDashboard />
            </BrowserRouter>
        );

        expect(screen.getByText('Failed to load dashboard data.')).toBeInTheDocument();
    });
});
