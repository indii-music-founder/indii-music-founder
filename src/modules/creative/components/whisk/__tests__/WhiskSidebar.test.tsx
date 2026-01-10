import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WhiskSidebar from '../WhiskSidebar';
import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/image/ImageGenerationService');

describe('WhiskSidebar', () => {
    const mockAddWhiskItem = vi.fn();
    const mockRemoveWhiskItem = vi.fn();
    const mockToggleWhiskItem = vi.fn();
    const mockUpdateWhiskItem = vi.fn();
    const mockSetPreciseReference = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastInfo = vi.fn();

    const mockWhiskState = {
        preciseReference: false,
        subjects: [{ id: '1', content: 'Robot', checked: true, type: 'text' }],
        scenes: [],
        styles: []
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            success: mockToastSuccess,
            info: mockToastInfo,
            warning: vi.fn(),
            error: vi.fn()
        });

        (useStore as any).mockReturnValue({
            whiskState: mockWhiskState,
            addWhiskItem: mockAddWhiskItem,
            removeWhiskItem: mockRemoveWhiskItem,
            toggleWhiskItem: mockToggleWhiskItem,
            updateWhiskItem: mockUpdateWhiskItem,
            setPreciseReference: mockSetPreciseReference
        });
    });

    it('renders sections correctly', () => {
        render(<WhiskSidebar />);
        expect(screen.getByText(/Subjects/i)).toBeInTheDocument();
        expect(screen.getByText(/Scenes/i)).toBeInTheDocument();
        expect(screen.getByText(/Styles/i)).toBeInTheDocument();
        expect(screen.getByText('Robot')).toBeInTheDocument();
    });

    it('toggles precise mode', () => {
        render(<WhiskSidebar />);
        const toggleBtn = screen.getByText('Precise').parentElement?.querySelector('button');
        if (toggleBtn) fireEvent.click(toggleBtn);
        expect(mockSetPreciseReference).toHaveBeenCalledWith(true);
    });

    it('shows input when clicking add button', () => {
        render(<WhiskSidebar />);
        const addButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-plus'));
        fireEvent.click(addButtons[0]);
        expect(screen.getByPlaceholderText(/Enter subject text/i)).toBeInTheDocument();
    });

    it('adds a text item on Enter', () => {
        render(<WhiskSidebar />);
        const addButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-plus'));
        fireEvent.click(addButtons[0]);
        const input = screen.getByPlaceholderText(/Enter subject text/i);
        fireEvent.change(input, { target: { value: 'Alien' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(mockAddWhiskItem).toHaveBeenCalledWith('subject', 'text', 'Alien', undefined);
    });

    it('toggles an item', () => {
        render(<WhiskSidebar />);
        // Find the button that contains a lucide-check or is the toggle button
        const robotItem = screen.getByText('Robot').closest('div');
        const toggleBtn = robotItem?.parentElement?.querySelector('button'); // The toggle button is the first child
        if (toggleBtn) fireEvent.click(toggleBtn);
        expect(mockToggleWhiskItem).toHaveBeenCalledWith('subject', '1');
    });

    it('removes an item', () => {
        render(<WhiskSidebar />);
        const removeBtn = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-trash2'));
        if (removeBtn) fireEvent.click(removeBtn);
        expect(mockRemoveWhiskItem).toHaveBeenCalledWith('subject', '1');
    });

    it('updates an item caption', () => {
        window.prompt = vi.fn().mockReturnValue('New Robot Caption');
        render(<WhiskSidebar />);
        // Find by title which is unique to the edit button
        const editBtn = screen.getByTitle('Edit Caption');
        fireEvent.click(editBtn);
        expect(mockUpdateWhiskItem).toHaveBeenCalledWith('subject', '1', { aiCaption: 'New Robot Caption' });
    });
});
