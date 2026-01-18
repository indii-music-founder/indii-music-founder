import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayersPanel } from '../LayersPanel';

// Mock Lucide icons to avoid rendering issues and keep DOM clean
vi.mock('lucide-react', () => ({
    Layers: () => <span data-testid="icon-layers" />,
    Eye: () => <span data-testid="icon-eye" />,
    EyeOff: () => <span data-testid="icon-eye-off" />,
    Lock: () => <span data-testid="icon-lock" />,
    Unlock: () => <span data-testid="icon-unlock" />,
    Trash2: () => <span data-testid="icon-trash" />,
    ChevronUp: () => <span data-testid="icon-up" />,
    ChevronDown: () => <span data-testid="icon-down" />,
    Type: () => <span data-testid="icon-type" />,
    Image: () => <span data-testid="icon-image" />,
    Square: () => <span data-testid="icon-square" />,
}));

describe('LayersPanel', () => {
    // Mock CanvasObject structure
    const mockOb1 = {
        id: '1',
        type: 'text',
        name: 'Layer 1',
        fabricObject: { type: 'text' }
    };
    const mockOb2 = {
        id: '2',
        type: 'image',
        name: 'Layer 2',
        fabricObject: { type: 'image' }
    };
    const mockLayers = [mockOb1, mockOb2] as any[];

    const defaultProps = {
        layers: mockLayers,
        selectedLayer: null,
        onSelectLayer: vi.fn(),
        onToggleVisibility: vi.fn(),
        onToggleLock: vi.fn(),
        onDeleteLayer: vi.fn(),
        onReorderLayer: vi.fn(),
    };

    it('renders empty state correctly', () => {
        render(<LayersPanel {...defaultProps} layers={[]} />);
        expect(screen.getByText('No layers yet')).toBeDefined();
    });

    it('renders list of layers', () => {
        render(<LayersPanel {...defaultProps} />);
        expect(screen.getByText('Layer 1')).toBeDefined();
        expect(screen.getByText('Layer 2')).toBeDefined();
    });

    it('handles layer selection', () => {
        render(<LayersPanel {...defaultProps} />);
        fireEvent.click(screen.getByText('Layer 1'));
        expect(defaultProps.onSelectLayer).toHaveBeenCalledWith(mockOb1);
    });

    it('handles visibility toggle', () => {
        render(<LayersPanel {...defaultProps} />);
        // Use accessible name to target specific layer regardless of order
        const visibilityBtn = screen.getByRole('button', { name: /Show layer Layer 1/i });
        fireEvent.click(visibilityBtn);
        expect(defaultProps.onToggleVisibility).toHaveBeenCalledWith(mockOb1);
    });

    it('handles lock toggle', () => {
        render(<LayersPanel {...defaultProps} />);
        const lockBtn = screen.getByRole('button', { name: /Lock layer Layer 1/i });
        fireEvent.click(lockBtn);
        expect(defaultProps.onToggleLock).toHaveBeenCalledWith(mockOb1);
    });

    it('handles deletion', () => {
        render(<LayersPanel {...defaultProps} />);
        const deleteBtn = screen.getByRole('button', { name: /Delete layer Layer 1/i });
        fireEvent.click(deleteBtn);
        expect(defaultProps.onDeleteLayer).toHaveBeenCalledWith(mockOb1);
    });
});
