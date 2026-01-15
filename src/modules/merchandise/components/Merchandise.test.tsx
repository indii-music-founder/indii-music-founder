import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { StandardMerch } from './StandardMerch';
import { ProMerch } from './ProMerch';
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
    const mockStandardProducts: MerchProduct[] = [
        { id: '1', userId: 'user-1', title: 'Kill Tee', image: 'img.jpg', price: '$25.00', category: 'standard', createdAt: new Date() },
        { id: '2', userId: 'user-1', title: 'Killer Cap', image: 'cap.jpg', price: '$15.00', category: 'standard', createdAt: new Date() }
    ];

    const mockProProducts: (MerchProduct & { revenue: number, units: number })[] = [
        { id: '3', userId: 'user-1', title: 'Viral Hoodie', image: 'hoodie.jpg', price: '$45.00', category: 'pro', revenue: 5000, units: 120, createdAt: new Date() },
        { id: '4', userId: 'user-1', title: 'Elite Bottle', image: 'bottle.jpg', price: '$35.00', category: 'pro', revenue: 3000, units: 85, createdAt: new Date() }
    ];

    const defaultMockReturn = {
        products: [...mockStandardProducts, ...mockProProducts],
        standardProducts: mockStandardProducts,
        proProducts: mockProProducts,
        catalog: [],
        stats: { totalRevenue: 3250, unitsSold: 150, conversionRate: 5.2, revenueChange: 12, unitsChange: 8 },
        topSellingProducts: mockProProducts,
        loading: false,
        error: null as string | null,
        addProduct: vi.fn(),
        deleteProduct: vi.fn(),
        createFromCatalog: vi.fn()
    };

    it('StandardMerch renders standard products', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            products: mockStandardProducts,
            standardProducts: mockStandardProducts,
            proProducts: [],
            topSellingProducts: [],
        } as any);

        render(<StandardMerch />);

        expect(screen.getByText('Kill Tee')).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
    });

    it('ProMerch renders pro products', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            products: mockProProducts,
            standardProducts: [],
            proProducts: mockProProducts,
            topSellingProducts: mockProProducts,
        } as any);

        render(<ProMerch />);

        expect(screen.getByText('Viral Hoodie')).toBeInTheDocument();
        expect(screen.getByText('$45.00')).toBeInTheDocument();
    });

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

        expect(screen.queryByTestId('merch-dashboard-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('merch-dashboard-loading')).toBeInTheDocument();
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
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
});
