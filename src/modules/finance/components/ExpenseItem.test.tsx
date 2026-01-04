import { render, screen } from '@testing-library/react';
import { ExpenseItem } from './ExpenseItem';
import { Expense } from '@/services/finance/FinanceService';
import { describe, it, expect } from 'vitest';
import React from 'react';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle-icon" />,
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
    createdAt: 1000,
  };

  it('renders expense details correctly', () => {
    render(<ExpenseItem expense={mockExpense} />);

    expect(screen.getByText('Guitar Center')).toBeInTheDocument();
    expect(screen.getByText('2023-01-15 • Equipment')).toBeInTheDocument();
    expect(screen.getByText('-$150.50')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
  });
});
