
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { StandardMerch } from './StandardMerch';
import { useMerchandise } from '../hooks/useMerchandise';

// Mock the hook
vi.mock('../hooks/useMerchandise', () => ({
    useMerchandise: vi.fn(),
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { id: 'test-user' }
    })
}));

describe('StandardMerch Loading States (Pulse)', () => {
    const defaultMockReturn = {
        products: [],
        standardProducts: [],
        proProducts: [],
        catalog: [],
        stats: { totalRevenue: 0, unitsSold: 0, conversionRate: 0, revenueChange: 0, unitsChange: 0 },
        topSellingProducts: [],
        loading: false,
        error: null,
        addProduct: vi.fn(),
        deleteProduct: vi.fn(),
        createFromCatalog: vi.fn()
    };

    it('displays loading indicator when data is fetching', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            loading: true,
        } as any);

        render(<StandardMerch />);

        const loader = screen.queryByRole('status') || screen.queryByTestId('merch-loader') || screen.queryByText(/loading/i);
        expect(loader).toBeInTheDocument();
    });

    it('displays content when loading is complete', () => {
        const mockProduct = {
            id: '1',
            title: 'Test Shirt',
            price: '$20',
            category: 'standard',
            image: 'img.jpg',
            userId: 'u1',
            createdAt: new Date()
        };

        vi.mocked(useMerchandise).mockReturnValue({
            ...defaultMockReturn,
            loading: false,
            standardProducts: [mockProduct],
        } as any);

        render(<StandardMerch />);

        expect(screen.getByText('Test Shirt')).toBeInTheDocument();
    });
});
