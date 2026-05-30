import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasToolbar } from './CanvasToolbar';

describe('CanvasToolbar', () => {
    const mockProps = {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        setTool: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        activeTool: 'select' as const,
        handleDetectObjects: vi.fn(),
        handleClearDetections: vi.fn(),
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

    it('calls setTool when text button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Text/i }));
        expect(mockProps.setTool).toHaveBeenCalledWith('text');
    });

    it('calls setTool when magic fill button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Magic Fill/i }));
        expect(mockProps.setTool).toHaveBeenCalledWith('brush');
    });

    it('shows active state for Select Tool button', () => {
        render(<CanvasToolbar {...mockProps} activeTool="select" />);
        const selectBtn = screen.getByRole('button', { name: /Select Tool/i });
        expect(selectBtn).toHaveClass('bg-dept-creative');
    });

    it('shows active state for Magic Fill button', () => {
        render(<CanvasToolbar {...mockProps} activeTool="brush" />);
        const magicFillBtn = screen.getByRole('button', { name: /Magic Fill/i });
        expect(magicFillBtn).toHaveClass('bg-dept-creative');
    });
});
