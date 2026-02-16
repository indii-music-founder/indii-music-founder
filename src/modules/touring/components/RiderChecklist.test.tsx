
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiderChecklist } from './RiderChecklist';
import { useRider } from '../hooks/useRider';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        Wine: () => <span data-testid="icon-wine" />,
        Coffee: () => <span data-testid="icon-coffee" />,
        Apple: () => <span data-testid="icon-apple" />,
        Droplet: () => <span data-testid="icon-droplet" />,
        Check: () => <span data-testid="icon-check" />,
        Plus: () => <span data-testid="icon-plus" />,
        Trash2: () => <span data-testid="icon-trash" />,
    };
});

// Mock hooks
vi.mock('../hooks/useRider', () => ({
    useRider: vi.fn(),
}));

// Setup function
const setupRiderMock = (overrides = {}) => {
    const defaultValues = {
        items: [],
        loading: false,
        addItem: vi.fn(),
        toggleItem: vi.fn(),
        deleteItem: vi.fn(),
    };
    vi.mocked(useRider).mockReturnValue({ ...defaultValues, ...overrides });
};

describe('RiderChecklist', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state correctly', () => {
        setupRiderMock({ items: [] });
        render(<RiderChecklist />);
        expect(screen.getByText('No items requested')).toBeInTheDocument();
    });

    it('renders loading state', () => {
        setupRiderMock({ loading: true });
        render(<RiderChecklist />);
        // Look for the spinner
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('renders items correctly', () => {
        const items = [
            { id: '1', label: 'Water', completed: false, category: 'drink' },
            { id: '2', label: 'Towels', completed: true, category: 'essential' },
        ];
        setupRiderMock({ items });
        render(<RiderChecklist />);

        expect(screen.getByText('Water')).toBeInTheDocument();
        expect(screen.getByText('Towels')).toBeInTheDocument();
        // Towels should have line-through style (or class)
        const towelsText = screen.getByText('Towels');
        expect(towelsText).toHaveClass('line-through');
    });

    it('allows adding an item', async () => {
        const addItemMock = vi.fn();
        setupRiderMock({ addItem: addItemMock });
        render(<RiderChecklist />);

        const input = screen.getByPlaceholderText('Add requirement...');
        fireEvent.change(input, { target: { value: 'Beer' } });

        const addButton = screen.getByLabelText('Add Item');
        fireEvent.click(addButton);

        expect(addItemMock).toHaveBeenCalledWith('Beer', 'essential');
    });

    it('allows deleting an item', async () => {
        const deleteItemMock = vi.fn();
        const items = [{ id: '1', label: 'Water', completed: false, category: 'drink' }];
        setupRiderMock({ items, deleteItem: deleteItemMock });

        render(<RiderChecklist />);

        // The delete button appears on hover, but in JSDOM we can just click it if it's in the DOM
        // Framer motion might handle opacity, but the button should be there.
        const deleteButton = screen.getByLabelText('Delete Item');
        fireEvent.click(deleteButton);

        expect(deleteItemMock).toHaveBeenCalledWith('1');
    });
});
