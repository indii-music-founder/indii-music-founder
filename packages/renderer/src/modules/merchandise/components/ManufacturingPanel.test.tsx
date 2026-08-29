import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import ManufacturingPanel from './ManufacturingPanel';
import { THEMES } from '@/modules/merchandise/themes';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';

// Mock MerchandiseService
const mockGetCatalog = vi.fn();
const mockRequestSample = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        userProfile: {
            displayName: 'Test User',
            shippingAddress: {
                street: "Test St",
                city: "Test City",
                state: "TC",
                zip: "12345",
                country: "Testland"
            }
        }
    }))
}));

vi.mock('@/services/merchandise/MerchandiseService', () => ({
    MerchandiseService: {
        submitToProduction: vi.fn(),
        getCatalog: () => mockGetCatalog(),
        requestSample: (...args: any[]) => mockRequestSample(...args)
    }
}));

// Mock toast (hoisted so tests can assert against the same fns the component sees)
const toastMocks = vi.hoisted(() => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => toastMocks,
}));

describe('ManufacturingPanel Cost Calculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses catalog price when available (e.g. "T-Shirt" matches "Standard Tee")', async () => {
        mockGetCatalog.mockResolvedValue([
            { id: '1', title: 'Standard Tee', basePrice: 24.99, category: 'standard', image: 'https://example.com/image.png' },
            { id: '2', title: 'Standard Tee 2', basePrice: 24.99, category: 'standard', image: 'https://example.com/tee.jpg' }
        ]);

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        // Catalog price 24.99.
        // Default quantity 100. Discount logic: Math.floor(100/50)*0.05 = 0.10 (10%).
        // 24.99 * (1 - 0.10) = 22.491 -> 22.49

        await waitFor(() => {
            expect(screen.getByText('$22.49')).toBeInTheDocument();
        });
    });

    it('falls back to BASE_COSTS if catalog match fails', async () => {
        mockGetCatalog.mockResolvedValue([]);

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        // BASE_COST 12.50
        // Discount 10%
        // 12.50 * 0.9 = 11.25

        await waitFor(() => {
            expect(screen.getByText('$11.25')).toBeInTheDocument();
        });
    });

    it('calls requestSample when Order Sample is clicked', async () => {
        mockGetCatalog.mockResolvedValue([]);
        mockRequestSample.mockResolvedValue({ success: true, requestId: 'SAMPLE-123' });
        const user = userEvent.setup();

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        const orderBtn = screen.getByText('Order Sample');
        await user.click(orderBtn);

        expect(mockRequestSample).toHaveBeenCalled();
    });
});

// ── ISSUE-1407 UI slice: honest draft copy + Stripe checkout redirect ──
const mockPODCreateOrder = vi.fn();
const mockPODCreateOrderCheckout = vi.fn();
const mockPODGetOrder = vi.fn();
const mockPODIsConfigured = vi.fn();

vi.mock('@/services/pod/PrintOnDemandService', () => ({
    PrintOnDemandService: {
        isConfigured: (...args: unknown[]) => mockPODIsConfigured(...args),
        createOrder: (...args: unknown[]) => mockPODCreateOrder(...args),
        createOrderCheckout: (...args: unknown[]) => mockPODCreateOrderCheckout(...args),
        getOrder: (...args: unknown[]) => mockPODGetOrder(...args),
    },
    PODProvider: {},
}));

const mockAssign = vi.fn();

describe('ManufacturingPanel POD checkout flow (ISSUE-1407)', () => {
    const { info: mockToastInfo, success: mockToastSuccess, error: mockToastError } = toastMocks;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        Object.defineProperty(window, 'location', {
            value: {
                ...window.location,
                origin: 'http://localhost:3000',
                pathname: '/merchandise',
                search: '',
                hash: '',
                assign: mockAssign,
            },
            writable: true,
        });
        mockPODIsConfigured.mockReturnValue(true);
        mockGetCatalog.mockResolvedValue([]);
        mockPODCreateOrder.mockResolvedValue({
            id: '12345', provider: 'printful', status: 'draft',
            items: [], estimatedDelivery: '5-7 business days',
        });
        mockPODCreateOrderCheckout.mockResolvedValue({
            checkoutUrl: 'https://checkout.stripe.com/c/pay/test', sessionId: 'cs_1',
            customerCents: 1563, currency: 'usd',
        });
    });

    async function submitPodOrder() {
        const user = userEvent.setup();
        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
                designUrl="https://example.com/design.png"
            />
        );
        await waitFor(() => expect(screen.queryByText(/isLoading/i)).not.toBeInTheDocument());
        await user.click(await screen.findByText('Print-on-Demand'));
        await user.click(await screen.findByText('Send to Production'));
    }

    it('never claims "Order Created": draft copy is honest, checkout is bound to the draft, and Stripe is opened', async () => {
        await submitPodOrder();

        await waitFor(() => expect(mockAssign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/test'));

        const infoCalls = mockToastInfo.mock.calls.map((call) => String(call[0]));
        expect(infoCalls.some((msg) => msg.includes('Draft saved with Printful'))).toBe(true);
        expect(infoCalls.some((msg) => msg.includes('payment is required'))).toBe(true);
        expect(mockToastSuccess).not.toHaveBeenCalled();

        expect(mockPODCreateOrderCheckout).toHaveBeenCalledWith(
            '12345',
            'http://localhost:3000/merchandise?podCheckout=success',
            'http://localhost:3000/merchandise?podCheckout=cancelled',
        );
        expect(sessionStorage.getItem('podCheckoutOrderId')).toBe('12345');
    });

    it('does not claim production when checkout binding fails — the draft stays unpaid and honest', async () => {
        mockPODCreateOrderCheckout.mockRejectedValue(new Error('Stripe down'));

        await submitPodOrder();

        await waitFor(() => expect(mockToastError).toHaveBeenCalled());
        const errCalls = mockToastError.mock.calls.map((call) => String(call[0]));
        expect(errCalls.some((msg) => msg.includes('unpaid'))).toBe(true);
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockAssign).not.toHaveBeenCalled();
    });

    it('cancelled checkout return never claims production', async () => {
        Object.defineProperty(window, 'location', {
            value: {
                ...window.location,
                origin: 'http://localhost:3000',
                pathname: '/merchandise',
                search: '?podCheckout=cancelled',
                hash: '',
                assign: mockAssign,
            },
            writable: true,
        });
        sessionStorage.setItem('podCheckoutOrderId', '12345');

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        await waitFor(() => expect(mockToastInfo).toHaveBeenCalled());
        const infoCalls = mockToastInfo.mock.calls.map((call) => String(call[0]));
        expect(infoCalls.some((msg) => msg.includes('cancelled') && msg.includes('unpaid'))).toBe(true);
        expect(mockPODGetOrder).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('podCheckoutOrderId')).toBe('12345');
    });
});
