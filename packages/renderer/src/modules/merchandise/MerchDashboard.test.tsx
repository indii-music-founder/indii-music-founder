import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MerchDashboard from '@/modules/merchandise/MerchDashboard';
import { useMerchandise } from '@/modules/merchandise/hooks/useMerchandise';
import type { MerchProduct } from '@/modules/merchandise/types';

vi.mock('@/modules/merchandise/hooks/useMerchandise', () => ({
    useMerchandise: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        userProfile: { id: 'test-user', displayName: 'Test Artist' },
        user: { uid: 'test-user', email: 'artist@indii.music' },
        generatedHistory: [],
        uploadedImages: [],
        currentProjectId: 'proj-001',
        currentOrganizationId: 'org-001',
        organizations: [{ id: 'org-001', name: 'Test Org', plan: 'pro', members: ['test-user'] }],
        addToHistory: vi.fn(),
    })),
}));

const mockToast = {
    loading: vi.fn().mockReturnValue('toast-loading-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const makeProduct = (overrides: Partial<MerchProduct> = {}): MerchProduct => ({
    id: `prod-${Math.random().toString(36).slice(2)}`,
    userId: 'test-user',
    title: 'Kill Tee',
    image: 'https://cdn.example.com/tee.jpg',
    price: '$25.00',
    category: 'standard',
    createdAt: new Date('2025-01-01'),
    ...overrides,
});

const mockStats: any = {
    totalRevenue: 8250,
    unitsSold: 312,
    conversionRate: 6.4,
    revenueChange: 18,
    unitsChange: 11,
    trendScore: 90,
    productionVelocity: 85,
    funnelData: {
        pageViews: 1000,
        addToCart: 200,
        checkout: 50,
    },
};

const standardProducts = [
    makeProduct({ id: 'std-1', title: 'Kill Tee', price: '$25.00', category: 'standard' }),
    makeProduct({ id: 'std-2', title: 'Killer Cap', price: '$15.00', category: 'standard' }),
];

const proProducts = [
    makeProduct({ id: 'pro-1', title: 'Viral Hoodie', price: '$45.00', category: 'pro' }),
    makeProduct({ id: 'pro-2', title: 'Elite Bottle', price: '$35.00', category: 'pro' }),
];

const defaultMockHook = {
    products: [...standardProducts, ...proProducts],
    standardProducts,
    proProducts,
    catalog: [],
    stats: mockStats,
    topSellingProducts: [...standardProducts, ...proProducts],
    loading: false,
    error: null as string | null,
    addProduct: vi.fn(),
    deleteProduct: vi.fn(),
    createFromCatalog: vi.fn(),
};

function renderDashboard(hookOverrides = {}) {
    vi.mocked(useMerchandise).mockReturnValue({
        ...defaultMockHook,
        ...hookOverrides,
    } as any);
    return render(
        <MemoryRouter initialEntries={['/merch']}>
            <MerchDashboard />
        </MemoryRouter>,
    );
}

describe('MerchDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows formatted revenue in stats', () => {
        renderDashboard();
        const revMatches = screen.getAllByText(/8[,.]?250|8250/);
        expect(revMatches.length).toBeGreaterThan(0);
    });

    it('shows units sold stat', () => {
        renderDashboard();
        const unitMatches = screen.getAllByText(/312/);
        expect(unitMatches.length).toBeGreaterThan(0);
    });

    it('shows conversion rate stat', () => {
        renderDashboard();
        const rateMatches = screen.getAllByText(/6\.4/);
        expect(rateMatches.length).toBeGreaterThan(0);
    });

    it('renders the design templates section', () => {
        renderDashboard();
        expect(screen.getAllByText(/templates?|quick start/i).length).toBeGreaterThan(0);
    });

    it('renders the POD partner status section', () => {
        renderDashboard();
        const podMatches = screen.getAllByText(/printful|printify|gooten/i);
        expect(podMatches.length).toBeGreaterThan(0);
    });

    it('renders funnel data labels', () => {
        renderDashboard();
        expect(screen.getByText(/page views?|views/i)).toBeInTheDocument();
    });

    it('renders product images with alt text or src', () => {
        renderDashboard();
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
        expect(images.some((img) => img.getAttribute('alt') || img.getAttribute('src'))).toBe(true);
    });

    it('shows positive revenue change indicator', () => {
        renderDashboard({ stats: { ...mockStats, revenueChange: 18 } });
        expect(screen.getByText(/\+?18%?|\+?18/)).toBeInTheDocument();
    });

    it('shows positive units change indicator', () => {
        renderDashboard({ stats: { ...mockStats, unitsChange: 11 } });
        expect(screen.getByText(/\+?11%?|\+?11/)).toBeInTheDocument();
    });
});
