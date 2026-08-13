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
  functions: {},
  remoteConfig: { defaultConfig: {} },
  functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
  getFirebaseAI: vi.fn(() => ({})),
  appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
  messaging: { getToken: vi.fn() }
}));
// Also mock repository since it imports firebase
vi.mock('@/services/storage/repository', () => ({
  getProfileFromStorage: vi.fn(),
  saveProfileToStorage: vi.fn()
}));

vi.mock('motion/react', () => ({
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
    (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);
    (useStore as unknown as import("vitest").Mock).mockReturnValue({
      userId: 'test-user'
    });
    (useFinance as unknown as import("vitest").Mock).mockReturnValue({
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
    mockAddExpense.mockResolvedValue({ id: 'expense-1' });
    render(<ExpenseTracker />);

    // Open modal
    fireEvent.click(screen.getByText('Add Manual'));

    // Check if modal is visible - "Add Expense" is the main header text
    expect(screen.getAllByText('Add Expense').length).toBeGreaterThanOrEqual(1);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Sweetwater'), {
      target: { value: 'Test Vendor' }
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' }
    });
    fireEvent.change(screen.getByLabelText('Payment Status'), {
      target: { value: 'paid' }
    });
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-10' }
    });

    // Submit - The button says "Confirm Ledger Entry"
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Ledger Entry' }));

    await waitFor(() => {
      expect(mockAddExpense).toHaveBeenCalledWith(expect.objectContaining({
        vendor: 'Test Vendor',
        amount: 100,
        userId: 'test-user',
        date: '2026-10-10',
        paymentStatus: 'paid',
        evidenceStatus: 'unverified'
      }));
    });

    // Check if manual entry modal is closed
    await waitFor(() => {
      // "Add Expense" is the header in the modal, but strictly speaking it might still be there if animation takes time
      // But with mocked AnimatePresence, it should unmount.
      expect(screen.queryByText('Manual Ledger Entry')).not.toBeInTheDocument();
    });
  });

  it('keeps manual expense data open when persistence fails', async () => {
    mockAddExpense.mockRejectedValueOnce(new Error('Firestore unavailable'));
    render(<ExpenseTracker />);

    fireEvent.click(screen.getByText('Add Manual'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Sweetwater'), {
      target: { value: 'Test Vendor' }
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' }
    });
    fireEvent.change(screen.getByLabelText('Payment Status'), {
      target: { value: 'expected' }
    });
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-10' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Ledger Entry' }));

    await waitFor(() => expect(mockAddExpense).toHaveBeenCalled());
    expect(screen.getByText('Manual Ledger Entry')).toBeInTheDocument();
    expect(mockToast.error).toHaveBeenCalledWith('Failed to add expense.');
    expect(mockToast.success).not.toHaveBeenCalledWith('Expense added manually.');
  });

  it('does not enable submission until date and payment status are explicit', () => {
    render(<ExpenseTracker />);
    fireEvent.click(screen.getByText('Add Manual'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Sweetwater'), { target: { value: 'Test Vendor' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });

    expect(screen.getByRole('button', { name: 'Confirm Ledger Entry' })).toBeDisabled();
    expect(mockAddExpense).not.toHaveBeenCalled();
  });

  it('shows receipt ingestion as unavailable instead of pretending to analyze files', () => {
    render(<ExpenseTracker />);

    expect(screen.getByText('Receipt upload unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Analyzing Receipt...')).not.toBeInTheDocument();
  });
});
