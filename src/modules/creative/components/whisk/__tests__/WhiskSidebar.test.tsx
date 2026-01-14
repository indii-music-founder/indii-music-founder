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
    const mockToastWarning = vi.fn();
    const mockToastError = vi.fn();

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
            warning: mockToastWarning,
            error: mockToastError
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

    it('handles QuotaExceededError during file upload', async () => {
        // Mock FileReader
        const mockReadAsDataURL = vi.fn();
        let capturedFileReader: any;

        class MockFileReader {
            readAsDataURL = mockReadAsDataURL;
            onload = null as any;
            constructor() {
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                capturedFileReader = this;
            }
        }

        // Save original
        const originalFileReader = window.FileReader;
        window.FileReader = MockFileReader as any;

        // Mock ImageGeneration.captionImage to reject with QuotaExceededError
        const quotaError = new Error('Quota exceeded details');
        (quotaError as any).name = 'QuotaExceededError';
        (ImageGeneration.captionImage as any) = vi.fn().mockRejectedValue(quotaError);

        render(<WhiskSidebar />);

        // Open add menu
        const addButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-plus'));
        fireEvent.click(addButtons[0]);

        // Find file input
        const fileInput = document.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();

        // Simulate file selection
        const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
        fireEvent.change(fileInput!, { target: { files: [file] } });

        // Verify readAsDataURL called
        expect(mockReadAsDataURL).toHaveBeenCalledWith(file);

        // Trigger the onload callback
        await waitFor(() => {
            if (capturedFileReader && capturedFileReader.onload) {
                capturedFileReader.onload({ target: { result: 'data:image/png;base64,fakecontent' } });
            }
        });

        // Check if toast.error was called
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('Quota exceeded details');
        });

        // Also check that it added the image anyway (fallback behavior)
        expect(mockAddWhiskItem).toHaveBeenCalledWith('subject', 'image', 'data:image/png;base64,fakecontent', undefined);

        // Restore
        window.FileReader = originalFileReader;
    });
});
