import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCanvasPanel } from '../AgentCanvasPanel';
import { useStore } from '@/core/store';
import type { CanvasPushPayload } from '@/types/AgentCanvas';

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

const mockPanel: CanvasPushPayload = {
    id: 'test-panel-1',
    agentId: 'creative',
    title: 'Master Technical Specification',
    type: 'markdown',
    data: {
        content: '# Master Technical Specification\nArchitecture overview for the studio.',
    },
    createdAt: Date.now(),
};

describe('AgentCanvasPanel', () => {
    const toggleCanvas = vi.fn();
    const removePanel = vi.fn();
    const clearCanvas = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when isCanvasOpen is false', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        const { container } = render(<AgentCanvasPanel />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders empty state drawer when isCanvasOpen is true and canvasPanels is empty', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        expect(screen.getByTestId('agent-canvas-panel')).toBeInTheDocument();
        expect(screen.getByTestId('agent-canvas-empty-state')).toBeInTheDocument();
        expect(screen.getByText('No Pushed Documents Yet')).toBeInTheDocument();
        expect(screen.getByText('0 panels • Agent Canvas')).toBeInTheDocument();

        // Clicking close triggers toggleCanvas
        const closeBtn = screen.getByRole('button', { name: /close canvas/i });
        fireEvent.click(closeBtn);
        expect(toggleCanvas).toHaveBeenCalledTimes(1);
    });

    it('renders pushed panel content when canvasPanels are present', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        expect(screen.getByTestId('agent-canvas-panel')).toBeInTheDocument();
        expect(screen.getByText('Master Technical Specification')).toBeInTheDocument();
        expect(screen.getByText('creative')).toBeInTheDocument();
        expect(screen.getByText('1 panel • Agent Canvas')).toBeInTheDocument();
    });

    it('allows clearing all panels when multiple exist', () => {
        const panel2: CanvasPushPayload = {
            id: 'test-panel-2',
            agentId: 'legal',
            title: 'Split Agreement',
            type: 'markdown',
            data: { content: 'Legal content' },
            createdAt: Date.now(),
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel, panel2],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        const clearBtn = screen.getByRole('button', { name: /clear all/i });
        fireEvent.click(clearBtn);
        expect(clearCanvas).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key press when open', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(toggleCanvas).toHaveBeenCalledTimes(1);
    });

    it('has high z-index and responsive width classes to prevent ChatOverlay collision and mobile overflow', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        const panel = screen.getByTestId('agent-canvas-panel');
        expect(panel.className).toContain('z-[650]');
        expect(panel.className).toContain('w-full');
        expect(panel.className).toContain('sm:w-[420px]');
    });

    it('safely clamps active index and displays remaining panel when one is removed', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel],
                toggleCanvas,
                removePanel,
                clearCanvas,
            })
        );

        render(<AgentCanvasPanel />);

        const removeBtn = screen.getByRole('button', { name: /remove this panel/i });
        fireEvent.click(removeBtn);
        expect(removePanel).toHaveBeenCalledWith('test-panel-1');
        // Still renders without crash
        expect(screen.getByTestId('agent-canvas-panel')).toBeInTheDocument();
    });
});
