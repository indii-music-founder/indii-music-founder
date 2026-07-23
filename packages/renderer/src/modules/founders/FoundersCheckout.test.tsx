import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('react-router-dom', () => ({
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

let mockStore: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({ useStore: (s: (st: Record<string, unknown>) => unknown) => s(mockStore) }));
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }));
vi.mock('@/utils/logger', () => ({ 
    logger: { 
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    } 
}));

// Mock payment service
vi.mock('@/services/payment/PaymentService', () => ({
    createOneTimePayment: vi.fn().mockRejectedValue(new Error('Stripe offline mock fallback'))
}));

import FoundersCheckout from './FoundersCheckout';

describe('FoundersCheckout', () => {
    beforeEach(() => {
        mockStore = {
            setModule: vi.fn(),
            user: { email: 'founder@test.com', displayName: 'Test Founder' }
        };
    });

    it('renders the path selection view on mount', () => {
        render(<FoundersCheckout />);
        expect(screen.getByText('Secure Founder Access')).toBeInTheDocument();
        expect(screen.getByText('Business Software Purchase')).toBeInTheDocument();
        expect(screen.getByText('Founding Support')).toBeInTheDocument();
    });

    it('renders the return to studio button', () => {
        render(<FoundersCheckout />);
        expect(screen.getByText('Return to Studio')).toBeInTheDocument();
    });

    it('navigates to agreement review and allows path checkout flow', async () => {
        render(<FoundersCheckout />);
        
        // Select 'Business Software Purchase' path
        const softwarePathBtn = screen.getByText('Business Software Purchase');
        fireEvent.click(softwarePathBtn);

        // Verify we transitioned to agreement review
        expect(screen.getByText('Founder Software Access Agreement')).toBeInTheDocument();
        expect(screen.getByText('Proceed to Payment')).toBeInTheDocument();
        expect(screen.getByText(/wiil@indii.music/)).toBeInTheDocument();

        // Click Proceed to Payment
        const paymentBtn = screen.getByText('Proceed to Payment');
        fireEvent.click(paymentBtn);

        // Verify we are on payment options screen
        expect(screen.getByText('Proceed to Secure Stripe Checkout')).toBeInTheDocument();

        // Click Stripe Checkout button
        const stripeBtn = screen.getByText('Proceed to Secure Stripe Checkout');
        fireEvent.click(stripeBtn);

        // Should show connection status or transition state (using waitFor for async state update)
        await waitFor(() => {
            expect(screen.getByText(/Connecting to Stripe/i)).toBeInTheDocument();
        });
    });

    it('shows an honest unavailable message when Stripe checkout cannot be created', async () => {
        render(<FoundersCheckout />);

        fireEvent.click(screen.getByText('Business Software Purchase'));
        fireEvent.click(screen.getByText('Proceed to Payment'));
        fireEvent.click(screen.getByText('Proceed to Secure Stripe Checkout'));

        await waitFor(() => {
            expect(screen.getByText('Stripe checkout is temporarily unavailable. Please try again or contact support.')).toBeInTheDocument();
        });
    });
});
