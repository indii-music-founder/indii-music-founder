import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasToolbar } from './CanvasToolbar';

describe('CanvasToolbar', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockProps = {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        addSketchLayer: vi.fn(),
        setTool: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        activeTool: 'select' as const,
        handleDetectObjects: vi.fn(),
        handleClearDetections: vi.fn(),
        hasDetections: false,
        toggleLayersPanel: vi.fn(),
        isLayersPanelOpen: false,
    };

    it('renders all tool buttons with accessible names', () => {
        render(<CanvasToolbar {...mockProps} />);
        expect(screen.getByRole('button', { name: /Add Text/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Layer/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Rectangle Layer/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Circle Layer/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Magic Fill/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ID Objects/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Layers Panel$/i })).toBeEnabled();
    });

    it('does not render any "Coming Soon" placeholder buttons', () => {
        render(<CanvasToolbar {...mockProps} />);
        expect(screen.queryByRole('button', { name: /Coming Soon/i })).not.toBeInTheDocument();
    });

    it('clears detections instead of detecting when detections already exist', () => {
        render(<CanvasToolbar {...mockProps} hasDetections={true} />);
        fireEvent.click(screen.getByRole('button', { name: /Clear Object Detections/i }));
        expect(mockProps.handleClearDetections).toHaveBeenCalledOnce();
        expect(mockProps.handleDetectObjects).not.toHaveBeenCalled();
    });

    it('calls toggleLayersPanel when the layers button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /^Layers Panel$/i }));
        expect(mockProps.toggleLayersPanel).toHaveBeenCalledOnce();
    });

    it('calls setTool when magic fill button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Magic Fill/i }));
        expect(mockProps.setTool).toHaveBeenCalledWith('brush');
    });

    it('calls setTool when text button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Text/i }));
        expect(mockProps.setTool).toHaveBeenCalledWith('text');
    });

    it('calls layer creation handlers from layer buttons', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Layer/i }));
        fireEvent.click(screen.getByRole('button', { name: /Add Rectangle Layer/i }));
        fireEvent.click(screen.getByRole('button', { name: /Add Circle Layer/i }));

        expect(mockProps.addSketchLayer).toHaveBeenCalledOnce();
        expect(mockProps.addRectangle).toHaveBeenCalledOnce();
        expect(mockProps.addCircle).toHaveBeenCalledOnce();
    });

    it('calls object detection when the ID button is clicked', () => {
        render(<CanvasToolbar {...mockProps} />);
        fireEvent.click(screen.getByRole('button', { name: /ID Objects/i }));
        expect(mockProps.handleDetectObjects).toHaveBeenCalledOnce();
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
