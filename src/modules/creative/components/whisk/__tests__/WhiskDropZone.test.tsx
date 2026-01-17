import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhiskDropZone } from '../WhiskDropZone';
import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { WhiskItem } from '@/core/store/slices/creativeSlice';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/image/ImageGenerationService');

describe('WhiskDropZone', () => {
    // Silence window.scrollTo not implemented error from framer-motion in jsdom
    beforeAll(() => {
        window.scrollTo = vi.fn();
    });

    const mockAddWhiskItem = vi.fn();
    const mockRemoveWhiskItem = vi.fn();
    const mockToggleWhiskItem = vi.fn();
    const mockUpdateWhiskItem = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastInfo = vi.fn();
    const mockToastWarning = vi.fn();
    const mockToastError = vi.fn();

    const mockItems: WhiskItem[] = [
        { id: '1', content: 'Robot', checked: true, type: 'text', category: 'subject' }
    ];


    const defaultProps = {
        title: 'Subject',
        category: 'subject' as const,
        items: mockItems,
        onAdd: mockAddWhiskItem,
        onRemove: mockRemoveWhiskItem,
        onToggle: mockToggleWhiskItem,
        onUpdate: mockUpdateWhiskItem,
        description: 'Describe subject'
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            success: mockToastSuccess,
            info: mockToastInfo,
            warning: mockToastWarning,
            error: mockToastError
        });

        // Some logic inside WhiskDropZone (handleDrop) imports store dynamically or uses it?
        // Actually handleDrop does dynamic import.
        (useStore as any).mockReturnValue({
            whiskState: {}, // Not really used directly
            generatedHistory: [],
            uploadedImages: []
        });
    });

    it('renders correctly', () => {
        render(<WhiskDropZone {...defaultProps} />);
        expect(screen.getByText(/Subject/i)).toBeInTheDocument();
        expect(screen.getByText('Robot')).toBeInTheDocument();
    });


    it('shows input when clicking add button', () => {
        render(<WhiskDropZone {...defaultProps} />);
        const addBtn = screen.getByRole('button', { name: 'Add new Subject' }); // Updated label logic
        fireEvent.click(addBtn);
        expect(screen.getByPlaceholderText(/Describe subject/i)).toBeInTheDocument();
    });

    it('adds a text item on Enter', () => {
        render(<WhiskDropZone {...defaultProps} />);
        const addBtn = screen.getByRole('button', { name: 'Add new Subject' });
        fireEvent.click(addBtn);
        const input = screen.getByPlaceholderText(/Describe subject/i);
        fireEvent.change(input, { target: { value: 'Alien' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(mockAddWhiskItem).toHaveBeenCalledWith('text', 'Alien');

    });

    it('toggles an item', () => {
        render(<WhiskDropZone {...defaultProps} />);
        const toggleBtn = screen.getByRole('checkbox', { name: 'Select Robot' });
        fireEvent.click(toggleBtn);
        expect(mockToggleWhiskItem).toHaveBeenCalledWith('1');
    });

    it('removes an item', () => {
        render(<WhiskDropZone {...defaultProps} />);
        const removeBtn = screen.getByRole('button', { name: 'Remove Robot' }); // The remove button title is "Remove" usually, let's check aria-label
        fireEvent.click(removeBtn);
        expect(mockRemoveWhiskItem).toHaveBeenCalledWith('1');
    });

    it('updates an item caption', () => {
        window.prompt = vi.fn().mockReturnValue('New Robot Caption');
        render(<WhiskDropZone {...defaultProps} />);
        const editBtn = screen.getByRole('button', { name: 'Edit text' });
        fireEvent.click(editBtn);
        expect(mockUpdateWhiskItem).toHaveBeenCalledWith('1', { aiCaption: 'New Robot Caption' });
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

        render(<WhiskDropZone {...defaultProps} />);

        // Open add menu
        const addBtn = screen.getByRole('button', { name: 'Add new Subject' });
        fireEvent.click(addBtn);

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
        // Also check that it added the image anyway (fallback behavior)
        expect(mockAddWhiskItem).toHaveBeenCalledWith('image', 'data:image/png;base64,fakecontent');


        // Restore
        window.FileReader = originalFileReader;
    });
});
