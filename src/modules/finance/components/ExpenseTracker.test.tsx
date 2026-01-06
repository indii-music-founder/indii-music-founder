import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExpenseTracker } from './ExpenseTracker';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFinance } from '../hooks/useFinance';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('../hooks/useFinance');
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
// Mock the firebase import that is causing issues
vi.mock('@/services/firebase', () => ({
  app: {},
  db: {},
  storage: {},
  auth: {},
  functions: {}
}));
// Also mock repository since it imports firebase
vi.mock('@/services/storage/repository', () => ({
    getProfileFromStorage: vi.fn(),
    saveProfileToStorage: vi.fn()
}));

vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false
  })
}));

describe('ExpenseTracker', () => {
  const mockAddExpense = vi.fn();
  const mockLoadExpenses = vi.fn();
  const mockToast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue(mockToast);
    (useStore as any).mockReturnValue({
      userProfile: { id: 'test-user' }
    });
    (useFinance as any).mockReturnValue({
      expenses: [],
      expensesLoading: false,
      actions: {
        loadExpenses: mockLoadExpenses,
        addExpense: mockAddExpense
      }
    });
  });

  it('renders correctly', () => {
    render(<ExpenseTracker />);
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
  });

  it('opens manual entry modal and submits expense', async () => {
    render(<ExpenseTracker />);

    // Open modal
    fireEvent.click(screen.getByText('Add Manual'));

    // Check if modal is visible
    expect(screen.getByText('Add Manual Expense')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Sweetwater'), {
      target: { value: 'Test Vendor' }
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' }
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));

    await waitFor(() => {
      expect(mockAddExpense).toHaveBeenCalledWith(expect.objectContaining({
        vendor: 'Test Vendor',
        amount: 100,
        userId: 'test-user'
      }));
    });

    // Check if modal closed (simplified check, usually queryByText should be null)
    await waitFor(() => {
        expect(screen.queryByText('Add Manual Expense')).not.toBeInTheDocument();
    });
  });
});
