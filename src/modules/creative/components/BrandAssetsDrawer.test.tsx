import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');

describe('BrandAssetsDrawer', () => {
    const mockUpdateBrandKit = vi.fn();
    const mockAddUploadedImage = vi.fn();
    const mockSetActiveReferenceImage = vi.fn();
    const mockToast = { success: vi.fn(), error: vi.fn() };
    const mockOnClose = vi.fn();

    const defaultStore = {
        userProfile: {
            brandKit: {
                brandAssets: [
                    { url: 'http://test.com/asset1.png', description: 'Asset 1' }
                ],
                referenceImages: [
                    { url: 'http://test.com/ref1.png', description: 'Ref 1' }
                ],
                colors: []
            }
        },
        updateBrandKit: mockUpdateBrandKit,
        addUploadedImage: mockAddUploadedImage,
        currentProjectId: 'test-project',
        setActiveReferenceImage: mockSetActiveReferenceImage
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(defaultStore);
        (useToast as any).mockReturnValue(mockToast);
    });

    it('renders correctly with assets', () => {
        render(<BrandAssetsDrawer onClose={mockOnClose} />);

        expect(screen.getByText('Brand Assets')).toBeInTheDocument();
        expect(screen.getByText('Logos & Graphics')).toBeInTheDocument();
        expect(screen.getByAltText('Asset 1')).toBeInTheDocument();
        expect(screen.getByAltText('Ref 1')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<BrandAssetsDrawer onClose={mockOnClose} />);

        // Find close button (X icon)
        // It's the button in the header.
        const closeButton = screen.getByRole('button', { name: '' }); // X icon usually has no text, might need better selector
        // Or find by SVG or parent
        // Let's rely on the fact it's likely the first button or use a test id if we could, but we can't change code.
        // The header has "Brand Assets" and a button.
        // Let's try to find the button inside the header div?
        // Or just click all buttons? No.
        // The X icon is from lucide-react.
        // Let's assume it's the button in the header.
        // We can find by class name if needed, but that's brittle.
        // Let's try `screen.getAllByRole('button')[0]`? No.

        // Let's use `container.querySelector` or look for the X icon if rendered as SVG.
        // But `lucide-react` renders SVGs.
        // Let's try to find by title if it had one, but it doesn't.
        // Let's try to find the button that contains the X icon.
        // Since we can't easily select by icon, let's just use `fireEvent.click` on the button that is likely the close button.
        // It is the only button in the header.
        // The header has text "Brand Assets".
        const header = screen.getByText('Brand Assets').closest('div');
        const button = header?.querySelector('button');
        fireEvent.click(button!);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('handles file upload via input', async () => {
        render(<BrandAssetsDrawer onClose={mockOnClose} />);

        const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });

        // The FileUpload component has an input with aria-label="File input"
        const inputElement = screen.getByLabelText('File input');

        fireEvent.change(inputElement, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockUpdateBrandKit).toHaveBeenCalled();
            expect(mockAddUploadedImage).toHaveBeenCalled();
            expect(mockToast.success).toHaveBeenCalled();
        });
    });

    it('adds asset to reference image when clicked', () => {
        render(<BrandAssetsDrawer onClose={mockOnClose} />);

        // Hover over asset to show button?
        // The button has opacity 0 until hover.
        // But `fireEvent.click` works even if opacity is 0 usually, unless `pointer-events-none` is set.
        // The button wrapper has `group-hover:opacity-100`.
        // The button itself doesn't have `pointer-events-none`.

        // Find the "Use as Reference" button.
        // It has title "Use as Reference".
        const addButton = screen.getByTitle('Use as Reference');
        fireEvent.click(addButton);

        expect(mockSetActiveReferenceImage).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://test.com/asset1.png',
            prompt: 'Asset 1'
        }));
        expect(mockToast.success).toHaveBeenCalled();
    });
});
