import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import AssetRack, { ProductType } from './AssetRack';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('AssetRack', () => {
    const mockOnAssetUpload = vi.fn();
    const mockOnTypeChange = vi.fn();

    const defaultProps = {
        productAsset: null,
        productType: 'T-Shirt' as ProductType,
        onAssetUpload: mockOnAssetUpload,
        onTypeChange: mockOnTypeChange,
        placement: 'Front' as const,
        onPlacementChange: vi.fn(),
        scale: 100,
        onScaleChange: vi.fn(),
    };

    it('renders correctly', () => {
        render(<AssetRack {...defaultProps} />);
        expect(screen.getByText('Topology')).toBeInTheDocument();
        expect(screen.getByText('T-Shirt')).toBeInTheDocument();
        expect(screen.getByText('Hoodie')).toBeInTheDocument();
    });

    it('calls onTypeChange when a product type is clicked', () => {
        render(<AssetRack {...defaultProps} />);
        fireEvent.click(screen.getByText('Hoodie'));
        expect(mockOnTypeChange).toHaveBeenCalledWith('Hoodie');
    });

    it('has accessible dropzone', () => {
        render(<AssetRack {...defaultProps} />);
        const dropzone = screen.getByLabelText('Upload design file');
        expect(dropzone).toHaveAttribute('role', 'button');
        expect(dropzone).toHaveAttribute('tabIndex', '0');
    });

    it('has accessible scale slider', () => {
        render(<AssetRack {...defaultProps} />);
        const slider = screen.getByLabelText('Product scale');
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute('type', 'range');
    });
});
