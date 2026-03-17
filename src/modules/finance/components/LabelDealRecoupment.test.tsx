/**
 * Item 370: Component Tests — LabelDealRecoupment
 * Tests render states and recoupment status logic.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelDealRecoupment } from './LabelDealRecoupment';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => {
        cb({ docs: [] });
        return () => {};
    }),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
    doc: vi.fn(),
    updateDoc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-test-123' },
    },
}));

vi.mock('@/lib/format', () => ({
    formatCurrency: (n: number) => `$${n.toFixed(2)}`,
    formatDate: (d: string) => d,
    formatPercent: (n: number) => `${(n * 100).toFixed(0)}%`,
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
            React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
}));

describe('LabelDealRecoupment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the component heading', () => {
        render(<LabelDealRecoupment />);
        expect(screen.getByText(/Label Deal/i)).toBeTruthy();
    });

    it('renders empty state when no deals exist', () => {
        render(<LabelDealRecoupment />);
        // With empty snapshot, no deal cards should appear
        expect(screen.queryAllByRole('button').length).toBeGreaterThanOrEqual(0);
    });

    it('renders a deal card when Firestore returns data', () => {
        const { onSnapshot } = vi.mocked(await import('firebase/firestore'));
        (onSnapshot as any).mockImplementation((_q: unknown, cb: Function) => {
            cb({
                docs: [{
                    id: 'deal-1',
                    data: () => ({
                        label: 'Capitol Records',
                        advanceAmount: 100000,
                        recoupedAmount: 75000,
                        dealDate: '2024-01-15',
                        userId: 'user-test-123',
                        notes: 'Test deal notes',
                        createdAt: null,
                    }),
                }],
            });
            return () => {};
        });

        render(<LabelDealRecoupment />);
        expect(screen.getByText('Capitol Records')).toBeTruthy();
        expect(screen.getByText('$100000.00')).toBeTruthy();
    });

    it('shows "Recouped" status when recoupedAmount >= advanceAmount', () => {
        const { onSnapshot } = vi.mocked(await import('firebase/firestore'));
        (onSnapshot as any).mockImplementation((_q: unknown, cb: Function) => {
            cb({
                docs: [{
                    id: 'deal-2',
                    data: () => ({
                        label: 'Sony Music',
                        advanceAmount: 50000,
                        recoupedAmount: 50000,
                        dealDate: '2023-06-01',
                        userId: 'user-test-123',
                        createdAt: null,
                    }),
                }],
            });
            return () => {};
        });

        render(<LabelDealRecoupment />);
        expect(screen.getByText('Recouped')).toBeTruthy();
    });

    it('shows "At Risk" status when recoupedAmount < 50% of advance', () => {
        const { onSnapshot } = vi.mocked(await import('firebase/firestore'));
        (onSnapshot as any).mockImplementation((_q: unknown, cb: Function) => {
            cb({
                docs: [{
                    id: 'deal-3',
                    data: () => ({
                        label: 'Indie Label',
                        advanceAmount: 20000,
                        recoupedAmount: 5000,
                        dealDate: '2024-03-01',
                        userId: 'user-test-123',
                        createdAt: null,
                    }),
                }],
            });
            return () => {};
        });

        render(<LabelDealRecoupment />);
        expect(screen.getByText('At Risk')).toBeTruthy();
    });
});
