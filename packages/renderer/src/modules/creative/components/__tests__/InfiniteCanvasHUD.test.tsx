import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { InfiniteCanvasHUD } from '../InfiniteCanvasHUD';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children, asChild: _ }: React.PropsWithChildren<{ asChild?: boolean }>) => <>{children}</>,
    TooltipContent: ({ children }: React.PropsWithChildren) => <div role="tooltip">{children}</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function renderHUD(overrides: Partial<{
    tool: 'pan' | 'select' | 'generate' | 'crop';
    selectedCanvasImageId: string | null;
    onFlatten?: () => void;
    onGenerateVariations?: () => void;
}> = {}) {
    const mockSetTool = vi.fn();
    const mockRemoveCanvasImage = vi.fn();

    const props = {
        tool: 'pan' as const,
        setTool: mockSetTool,
        selectedCanvasImageId: null,
        removeCanvasImage: mockRemoveCanvasImage,
        ...overrides,
    };

    const result = render(<InfiniteCanvasHUD {...props} />);
    return { ...result, mockSetTool, mockRemoveCanvasImage };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('InfiniteCanvasHUD — Canvas Toolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Tool Buttons Render ---

    it('renders all 4 core tool buttons', () => {
        renderHUD();
        expect(screen.getByRole('button', { name: /Pan Tool/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Select\/Move Tool/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate\/Outpaint Tool/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Adaptive Crop/i })).toBeInTheDocument();
    });

    it('renders the Delete Selected button', () => {
        renderHUD();
        expect(screen.getByRole('button', { name: /Delete Selected/i })).toBeInTheDocument();
    });

    // --- Active Tool State ---

    it('marks Pan button as pressed when tool is pan', () => {
        renderHUD({ tool: 'pan' });
        const panBtn = screen.getByRole('button', { name: /Pan Tool/i });
        expect(panBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks Select button as pressed when tool is select', () => {
        renderHUD({ tool: 'select' });
        const selectBtn = screen.getByRole('button', { name: /Select\/Move Tool/i });
        expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks Generate button as pressed when tool is generate', () => {
        renderHUD({ tool: 'generate' });
        const genBtn = screen.getByRole('button', { name: /Generate\/Outpaint Tool/i });
        expect(genBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks Crop button as pressed when tool is crop', () => {
        renderHUD({ tool: 'crop' });
        const cropBtn = screen.getByRole('button', { name: /Adaptive Crop/i });
        expect(cropBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('other tools are not pressed when crop is active', () => {
        renderHUD({ tool: 'crop' });
        expect(screen.getByRole('button', { name: /Pan Tool/i })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /Select\/Move Tool/i })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /Generate\/Outpaint Tool/i })).toHaveAttribute('aria-pressed', 'false');
    });

    // --- Tool Selection ---

    it('calls setTool("pan") when Pan is clicked', () => {
        const { mockSetTool } = renderHUD({ tool: 'select' });
        fireEvent.click(screen.getByRole('button', { name: /Pan Tool/i }));
        expect(mockSetTool).toHaveBeenCalledWith('pan');
    });

    it('calls setTool("select") when Select is clicked', () => {
        const { mockSetTool } = renderHUD({ tool: 'pan' });
        fireEvent.click(screen.getByRole('button', { name: /Select\/Move Tool/i }));
        expect(mockSetTool).toHaveBeenCalledWith('select');
    });

    it('calls setTool("generate") when Generate is clicked', () => {
        const { mockSetTool } = renderHUD({ tool: 'pan' });
        fireEvent.click(screen.getByRole('button', { name: /Generate\/Outpaint Tool/i }));
        expect(mockSetTool).toHaveBeenCalledWith('generate');
    });

    it('calls setTool("crop") when Crop is clicked', () => {
        const { mockSetTool } = renderHUD({ tool: 'pan' });
        fireEvent.click(screen.getByRole('button', { name: /Adaptive Crop/i }));
        expect(mockSetTool).toHaveBeenCalledWith('crop');
    });

    // --- Delete Selected ---

    it('Delete button is disabled when no image is selected', () => {
        renderHUD({ selectedCanvasImageId: null });
        expect(screen.getByRole('button', { name: /Delete Selected/i })).toBeDisabled();
    });

    it('Delete button is enabled when an image is selected', () => {
        renderHUD({ selectedCanvasImageId: 'canvas-img-abc' });
        expect(screen.getByRole('button', { name: /Delete Selected/i })).not.toBeDisabled();
    });

    it('calls removeCanvasImage with the selected ID when Delete is clicked', () => {
        const { mockRemoveCanvasImage } = renderHUD({ selectedCanvasImageId: 'canvas-img-xyz' });
        fireEvent.click(screen.getByRole('button', { name: /Delete Selected/i }));
        expect(mockRemoveCanvasImage).toHaveBeenCalledWith('canvas-img-xyz');
    });

    it('does not call removeCanvasImage when nothing is selected', () => {
        const { mockRemoveCanvasImage } = renderHUD({ selectedCanvasImageId: null });
        fireEvent.click(screen.getByRole('button', { name: /Delete Selected/i }));
        expect(mockRemoveCanvasImage).not.toHaveBeenCalled();
    });

    // --- Flatten Canvas (optional) ---

    it('does NOT render Flatten button when onFlatten is not provided', () => {
        renderHUD();
        expect(screen.queryByRole('button', { name: /Flatten Canvas/i })).not.toBeInTheDocument();
    });

    it('renders Flatten button when onFlatten is provided', () => {
        renderHUD({ onFlatten: vi.fn() });
        expect(screen.getByRole('button', { name: /Flatten Canvas/i })).toBeInTheDocument();
    });

    it('calls onFlatten when Flatten button is clicked', () => {
        const onFlatten = vi.fn();
        renderHUD({ onFlatten });
        fireEvent.click(screen.getByRole('button', { name: /Flatten Canvas/i }));
        expect(onFlatten).toHaveBeenCalledOnce();
    });

    // --- Generate Variations (optional) ---

    it('does NOT render Variations button when onGenerateVariations is not provided', () => {
        renderHUD();
        expect(screen.queryByRole('button', { name: /Generate Variations/i })).not.toBeInTheDocument();
    });

    it('renders Variations button when onGenerateVariations is provided', () => {
        renderHUD({ onGenerateVariations: vi.fn() });
        expect(screen.getByRole('button', { name: /Generate Variations/i })).toBeInTheDocument();
    });

    it('Variations button is disabled when no image is selected', () => {
        renderHUD({ onGenerateVariations: vi.fn(), selectedCanvasImageId: null });
        expect(screen.getByRole('button', { name: /Generate Variations/i })).toBeDisabled();
    });

    it('Variations button is enabled when an image is selected', () => {
        renderHUD({ onGenerateVariations: vi.fn(), selectedCanvasImageId: 'img-1' });
        expect(screen.getByRole('button', { name: /Generate Variations/i })).not.toBeDisabled();
    });

    it('calls onGenerateVariations when Variations button is clicked', () => {
        const onGenerateVariations = vi.fn();
        renderHUD({ onGenerateVariations, selectedCanvasImageId: 'img-1' });
        fireEvent.click(screen.getByRole('button', { name: /Generate Variations/i }));
        expect(onGenerateVariations).toHaveBeenCalledOnce();
    });

    // --- Accessibility ---

    it('all tool buttons have aria-label attributes', () => {
        renderHUD();
        const buttonsWithLabel = screen.getAllByRole('button').filter(btn => btn.hasAttribute('aria-label'));
        expect(buttonsWithLabel.length).toBeGreaterThanOrEqual(4);
    });
});
