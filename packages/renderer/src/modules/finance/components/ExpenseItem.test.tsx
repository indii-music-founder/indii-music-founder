import { render, screen } from '@testing-library/react';
import { ExpenseItem } from './ExpenseItem';
import { Expense } from '@/services/finance/FinanceService';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal: <T>() => Promise<T>) => ({
  ...(await importOriginal<typeof import('lucide-react')>()),
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Receipt: () => <div data-testid="receipt-icon" />,
}));

describe('ExpenseItem', () => {
  const mockExpense: Expense = {
    id: '123',
    userId: 'user1',
    vendor: 'Guitar Center',
    date: '2023-01-15',
    amount: 150.50,
    category: 'Equipment',
    description: 'New cables',
    paymentStatus: 'paid',
    evidenceStatus: 'unverified',
    createdAt: 1000,
  };

  it('renders expense details correctly', () => {
    render(<ExpenseItem expense={mockExpense} />);

    expect(screen.getByText('Guitar Center')).toBeInTheDocument();
    expect(screen.getByText('2023-01-15 • Equipment')).toBeInTheDocument();
    expect(screen.getByText('-$150.50')).toBeInTheDocument();
    expect(screen.getByText('Paid · Unverified')).toBeInTheDocument();
  });

  it('does not present an expected expense as paid or verified', () => {
    render(<ExpenseItem expense={{ ...mockExpense, paymentStatus: 'expected', evidenceStatus: 'unverified' }} />);

    expect(screen.getByText('$150.50')).toBeInTheDocument();
    expect(screen.getByText('Expected · Unverified')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('requires classification for legacy records with no payment state', () => {
    render(<ExpenseItem expense={{ ...mockExpense, paymentStatus: undefined }} />);

    expect(screen.getByText('Payment status needed · Unverified')).toBeInTheDocument();
  });
});
