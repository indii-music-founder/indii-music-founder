import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Expense } from '../schemas';
import { HiddenCostHarnessPanel } from './HiddenCostHarnessPanel';

const expense = (amount: number, paymentStatus?: Expense['paymentStatus']): Expense => ({
    id: `${amount}-${paymentStatus ?? 'legacy'}`,
    userId: 'artist-1',
    vendor: 'Test Vendor',
    amount,
    category: 'Equipment',
    date: '2026-10-10',
    description: 'Test cost',
    paymentStatus,
    evidenceStatus: 'unverified',
});

describe('HiddenCostHarnessPanel', () => {
    it('keeps the sample scenario and unpaid records out of artist totals', () => {
        render(<HiddenCostHarnessPanel expenses={[
            expense(100, 'paid'),
            expense(85, 'expected'),
            expense(20),
        ]} />);

        expect(screen.getAllByText('$100.00')).toHaveLength(2);
        expect(screen.queryByText('$85.00')).not.toBeInTheDocument();
        expect(screen.queryByText('$20.00')).not.toBeInTheDocument();
        expect(screen.getByText(/excluded from your totals/i)).toBeInTheDocument();
        expect(screen.getByText('$14.99')).toBeInTheDocument();
    });
});
