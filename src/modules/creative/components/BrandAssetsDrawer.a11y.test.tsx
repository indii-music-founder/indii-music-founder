import React from 'react';
import { render, screen } from '@testing-library/react';
import BrandAssetsDrawer from './BrandAssetsDrawer';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn()
}));

vi.mock('@/components/kokonutui/file-upload', () => ({
    default: () => <div data-testid="file-upload">File Upload</div>
}));

describe('BrandAssetsDrawer Accessibility', () => {
    beforeEach(() => {
        (useStore as any).mockReturnValue({
            userProfile: {
                brandKit: {
                    brandAssets: [
                        { url: 'asset1.jpg', description: 'Asset 1' }
                    ],
                    referenceImages: []
                }
            },
            updateBrandKit: vi.fn(),
            addUploadedImage: vi.fn(),
            currentProjectId: 'test-project',
            setActiveReferenceImage: vi.fn()
        });
        (useToast as any).mockReturnValue({
            success: vi.fn(),
            error: vi.fn()
        });
    });

    it('close button should have aria-label', () => {
        render(<BrandAssetsDrawer onClose={vi.fn()} />);
        const closeButton = screen.getByLabelText('Close brand assets');
        expect(closeButton).toBeInTheDocument();
    });

    it('action buttons should have aria-labels', () => {
        render(<BrandAssetsDrawer onClose={vi.fn()} />);
        // The "Use as Reference" button appears on hover in the asset grid
        // Since we mock the assets, we expect one asset to be rendered
        const actionButton = screen.getByLabelText('Use as Reference');
        expect(actionButton).toBeInTheDocument();
    });
});
