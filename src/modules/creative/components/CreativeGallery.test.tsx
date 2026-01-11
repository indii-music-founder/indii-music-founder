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
        setSelectedItem: vi.fn(),
        setEntityAnchor: vi.fn()
    };

    beforeEach(() => {
        (useStore as any).mockReturnValue(mockStore);
    });

    vi.mock('@/components/kokonutui/file-upload', () => ({
        default: () => <div data-testid="file-upload">Mock File Upload</div>
    }));

    it('renders empty state with upload icon', () => {
        render(<CreativeGallery />);

        // Check for empty state text
        expect(screen.getByText('No assets yet')).toBeInTheDocument();
        expect(screen.getByText('Upload or generate to see them here')).toBeInTheDocument();
    });

    it('renders generated history items correctly', () => {
        (useStore as any).mockReturnValue({
            ...mockStore,
            generatedHistory: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test prompt' }],
            uploadedImages: []
        });

        render(<CreativeGallery />);

        expect(screen.getByText('Generation History')).toBeInTheDocument();
        expect(screen.getByText('test prompt')).toBeInTheDocument();
        expect(screen.getByAltText('test prompt')).toBeInTheDocument();
    });

    it('buttons have accessibility attributes', () => {
        (useStore as any).mockReturnValue({
            ...mockStore,
            generatedHistory: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test prompt' }],
            uploadedImages: []
        });

        render(<CreativeGallery />);

        // Check for aria-labels on buttons
        expect(screen.getByLabelText('Like')).toBeInTheDocument();
        expect(screen.getByLabelText('Dislike')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete')).toBeInTheDocument();
        expect(screen.getByLabelText('View Fullsize')).toBeInTheDocument();

        // Check for role="button" on the item container
        expect(screen.getByRole('button', { name: 'Select test prompt' })).toBeInTheDocument();
    });
});
