import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import AssetRack, { ProductType } from './AssetRack';
import { expect, describe, it } from 'vitest';
import '@testing-library/jest-dom'; // Ensure jest-dom matchers are available

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
        const dropzone = screen.getByLabelText('Upload source graphic');
        expect(dropzone).toHaveAttribute('role', 'button');
        expect(dropzone).toHaveAttribute('tabIndex', '0');
    });

    it('has accessible scale slider', () => {
        render(<AssetRack {...defaultProps} />);
        const slider = screen.getByLabelText('Product scale');
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute('type', 'range');
    });
    it('has accessible attributes', () => {
        render(<AssetRack {...defaultProps} />);

        // Check for role="button" on dropzone
        const dropzone = screen.getByLabelText('Upload source graphic');
        expect(dropzone).toHaveAttribute('role', 'button');
        expect(dropzone).toHaveAttribute('tabIndex', '0');

        // Check for aria-pressed on product type buttons
        const tShirtButton = screen.getByLabelText('Select product type: T-Shirt');
        expect(tShirtButton).toHaveAttribute('aria-pressed', 'true');

        const hoodieButton = screen.getByLabelText('Select product type: Hoodie');
        expect(hoodieButton).toHaveAttribute('aria-pressed', 'false');

        // Check for aria-pressed on placement buttons
        const frontButton = screen.getByRole('button', { name: /Front/i });
        expect(frontButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('supports keyboard interaction on dropzone', () => {
        // Create a ref mock if needed, but since we mock motion.div as div, standard events apply
        render(<AssetRack {...defaultProps} />);
        const dropzone = screen.getByLabelText('Upload source graphic');

        // Mock the file input click
        const fileInput = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(fileInput, 'click');

        fireEvent.keyDown(dropzone, { key: 'Enter', code: 'Enter' });
        expect(clickSpy).toHaveBeenCalled();

        clickSpy.mockClear();
        fireEvent.keyDown(dropzone, { key: ' ', code: 'Space' });
        expect(clickSpy).toHaveBeenCalled();
    });
});
