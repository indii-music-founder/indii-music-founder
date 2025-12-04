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

    it('renders all tool buttons', () => {
        render(<CanvasToolbar {...mockProps} />);
        expect(screen.getByTitle('Add Rectangle')).toBeInTheDocument();
        expect(screen.getByTitle('Add Circle')).toBeInTheDocument();
        expect(screen.getByTitle('Add Text')).toBeInTheDocument();
        expect(screen.getByTitle('Magic Fill')).toBeInTheDocument();
    });

    it('calls addRectangle when rectangle button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByTitle('Add Rectangle'));
        expect(mockProps.addRectangle).toHaveBeenCalled();
    });

    it('calls addCircle when circle button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByTitle('Add Circle'));
        expect(mockProps.addCircle).toHaveBeenCalled();
    });

    it('calls addText when text button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByTitle('Add Text'));
        expect(mockProps.addText).toHaveBeenCalled();
    });

    it('calls toggleMagicFill when magic fill button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByTitle('Magic Fill'));
        expect(mockProps.toggleMagicFill).toHaveBeenCalled();
    });

    it('shows active state for Magic Fill button', () => {
        render(<CanvasToolbar {...mockProps} isMagicFillMode={true} />);
        const magicFillBtn = screen.getByTitle('Magic Fill');
        expect(magicFillBtn).toHaveClass('bg-purple-600');
    });
});
