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
        uploadedAudio: [],
        removeFromHistory: vi.fn(),
        addUploadedImage: vi.fn(),
        removeUploadedImage: vi.fn(),
        addUploadedAudio: vi.fn(),
        removeUploadedAudio: vi.fn(),
        currentProjectId: 'p1',
        generationMode: 'image',
        setVideoInput: vi.fn(),
        selectedItem: null,
        setSelectedItem: vi.fn(),
        setEntityAnchor: vi.fn()
    };

    beforeEach(() => {
        (useStore as import("vitest").Mock).mockImplementation((selector: any) => selector ? selector(mockStore) : mockStore);
    });

    vi.mock('@/components/kokonutui/file-upload', () => ({
        default: () => <div data-testid="file-upload">Mock File Upload</div>
    }));

    it('renders empty state with upload icon', () => {
        render(<CreativeGallery />);

        // Check for empty state text
        expect(screen.getByText('GALLERY IS EMPTY')).toBeInTheDocument();
        expect(screen.getByText('Upload media or generate new AI assets to see them appear in your gallery.')).toBeInTheDocument();
    });

    it('renders generated history items correctly', () => {
        (useStore as import("vitest").Mock).mockReturnValue({
            ...mockStore,
            generatedHistory: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test prompt', timestamp: 1000, projectId: 'p1', origin: 'generated' }],
            uploadedImages: [],
            uploadedAudio: []
        });

        render(<CreativeGallery />);

        expect(screen.getByText('All Assets')).toBeInTheDocument();
        expect(screen.getByText('test prompt')).toBeInTheDocument();
        expect(screen.getByAltText('test prompt')).toBeInTheDocument();
    });

    it('buttons have accessibility attributes', () => {
        (useStore as import("vitest").Mock).mockReturnValue({
            ...mockStore,
            generatedHistory: [{ id: '1', url: 'test.jpg', type: 'image', prompt: 'test prompt', timestamp: 1000, projectId: 'p1', origin: 'generated' }],
            uploadedImages: [],
            uploadedAudio: []
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
