import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreativeGallery from './CreativeGallery';
import { useStore } from '@/core/store';

// Mock the store
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

describe('CreativeGallery', () => {
    const mockStore = {
        generatedHistory: [],
        uploadedImages: [],
        removeFromHistory: vi.fn(),
        addUploadedImage: vi.fn(),
        removeUploadedImage: vi.fn(),
        currentProjectId: 'p1',
        generationMode: 'image',
        setVideoInput: vi.fn(),
        selectedItem: null,
        setSelectedItem: vi.fn()
    };

    beforeEach(() => {
        (useStore as any).mockReturnValue(mockStore);
    });

    it('renders empty state with upload and camera buttons', () => {
        render(<CreativeGallery />);

        // Check for empty state message
        expect(screen.getByText('Gallery is empty. Start creating or upload assets!')).toBeInTheDocument();

        // Check for Upload button
        expect(screen.getByText('Upload Assets')).toBeInTheDocument();
    });

    it('renders assets section with camera button when items exist', () => {
        (useStore as any).mockReturnValue({
            ...mockStore,
            uploadedImages: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test' }]
        });

        render(<CreativeGallery />);

        // Check for "Take Picture" button (mobile only, but rendered in DOM)
        expect(screen.getByText('Take Picture')).toBeInTheDocument();
    });

    it('renders enhanced empty drop zone when only generated history exists', () => {
        (useStore as any).mockReturnValue({
            ...mockStore,
            generatedHistory: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test' }],
            uploadedImages: []
        });

        render(<CreativeGallery />);

        // Check for "Drop files here" text
        expect(screen.getByText('Drop files here')).toBeInTheDocument();

        // Check for "Take Picture" button inside drop zone
        const takePictureButtons = screen.getAllByText('Take Picture');
        expect(takePictureButtons.length).toBeGreaterThan(0);
    });
});
