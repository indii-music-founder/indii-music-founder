import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('framer-motion', () => ({
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
vi.mock('@/services/payment/PaymentService', () => ({ createOneTimePayment: vi.fn() }));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }));

import FoundersCheckout from './FoundersCheckout';

describe('FoundersCheckout', () => {
    beforeEach(() => {
        mockStore = {
            user: { uid: 'user-1' },
            setModule: vi.fn(),
        };
    });

    it('renders the pre-checkout view with CTA', () => {
        render(<FoundersCheckout />);
        expect(screen.getByText(/Back The/)).toBeInTheDocument();
        expect(screen.getByText(/Support The Vision/)).toBeInTheDocument();
    });

    it('shows the Founders Round badge', () => {
        render(<FoundersCheckout />);
        expect(screen.getByText('Founders Round')).toBeInTheDocument();
    });

    it('renders the return to studio button', () => {
        render(<FoundersCheckout />);
        expect(screen.getByText('Return to Studio')).toBeInTheDocument();
    });
});
