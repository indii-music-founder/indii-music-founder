import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasToolbar } from './CanvasToolbar';

describe('CanvasToolbar', () => {
    const mockProps = {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        toggleMagicFill: vi.fn(),
        isMagicFillMode: false,
    };

    it('renders all tool buttons with accessible names', () => {
        render(<CanvasToolbar {...mockProps} />);
        expect(screen.getByRole('button', { name: /Add Rectangle/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Circle/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Text/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Magic Fill/i })).toBeInTheDocument();
    });

    it('calls addRectangle when rectangle button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Rectangle/i }));
        expect(mockProps.addRectangle).toHaveBeenCalled();
    });

    it('calls addCircle when circle button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Circle/i }));
        expect(mockProps.addCircle).toHaveBeenCalled();
    });

    it('calls addText when text button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Text/i }));
        expect(mockProps.addText).toHaveBeenCalled();
    });

    it('calls toggleMagicFill when magic fill button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Magic Fill/i }));
        expect(mockProps.toggleMagicFill).toHaveBeenCalled();
    });

    it('shows active state for Magic Fill button', () => {
        render(<CanvasToolbar {...mockProps} isMagicFillMode={true} />);
        const magicFillBtn = screen.getByRole('button', { name: /Magic Fill/i });
        expect(magicFillBtn).toHaveClass('bg-purple-600');
        expect(magicFillBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows inactive state for Magic Fill button', () => {
        render(<CanvasToolbar {...mockProps} isMagicFillMode={false} />);
        const magicFillBtn = screen.getByRole('button', { name: /Magic Fill/i });
        expect(magicFillBtn).toHaveAttribute('aria-pressed', 'false');
    });
});
