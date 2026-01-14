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

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
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

    // Check if modal is visible - "Add Expense" is the main header text
    expect(screen.getByText('Add Expense')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Sweetwater'), {
      target: { value: 'Test Vendor' }
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' }
    });

    // Submit - The button says "Confirm Ledger Entry"
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Ledger Entry' }));

    await waitFor(() => {
      expect(mockAddExpense).toHaveBeenCalledWith(expect.objectContaining({
        vendor: 'Test Vendor',
        amount: 100,
        userId: 'test-user'
      }));
    });

    // Check if manual entry modal is closed
    await waitFor(() => {
      // "Add Expense" is the header in the modal, but strictly speaking it might still be there if animation takes time
      // But with mocked AnimatePresence, it should unmount.
      expect(screen.queryByText('Manual Ledger Entry')).not.toBeInTheDocument();
    });
  });
});
