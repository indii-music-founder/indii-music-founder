import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfiniteCanvasHUD } from './InfiniteCanvasHUD';
import { vi } from 'vitest';

describe('InfiniteCanvasHUD', () => {
    const mockSetTool = vi.fn();
    const mockRemoveCanvasImage = vi.fn();

    const defaultProps = {
        tool: 'pan' as const,
        setTool: mockSetTool,
        selectedCanvasImageId: null,
        removeCanvasImage: mockRemoveCanvasImage,
    };

    it('renders all tool buttons', () => {
        render(<InfiniteCanvasHUD {...defaultProps} />);

        // At this point, we expect these to fail finding by label,
        // but we can try to find them by title which exists currently
        expect(screen.getByTitle('Pan Tool')).toBeInTheDocument();
        expect(screen.getByTitle('Select/Move Tool')).toBeInTheDocument();
        expect(screen.getByTitle('Generate/Outpaint Tool')).toBeInTheDocument();
        expect(screen.getByTitle('Delete Selected')).toBeInTheDocument();
    });

    it('should have accessible labels for all buttons', () => {
        render(<InfiniteCanvasHUD {...defaultProps} />);

        // These queries will fail until we add aria-labels
        expect(screen.getByLabelText('Pan Tool')).toBeInTheDocument();
        expect(screen.getByLabelText('Select/Move Tool')).toBeInTheDocument();
        expect(screen.getByLabelText('Generate/Outpaint Tool')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete Selected')).toBeInTheDocument();
    });

    it('indicates the active tool using aria-pressed', () => {
        render(<InfiniteCanvasHUD {...defaultProps} tool="select" />);

        const selectButton = screen.getByTitle('Select/Move Tool');
        const panButton = screen.getByTitle('Pan Tool');

        // This expects aria-pressed attribute
        expect(selectButton).toHaveAttribute('aria-pressed', 'true');
        expect(panButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls setTool when buttons are clicked', () => {
        render(<InfiniteCanvasHUD {...defaultProps} />);

        fireEvent.click(screen.getByTitle('Select/Move Tool'));
        expect(mockSetTool).toHaveBeenCalledWith('select');
    });
});
