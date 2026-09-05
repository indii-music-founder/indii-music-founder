import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCanvasToggle } from '../AgentCanvasToggle';
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
        content: '# Spec\nDetails here',
    },
    createdAt: Date.now(),
};

describe('AgentCanvasToggle', () => {
    const toggleCanvas = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders closed state with zero panels', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="header" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-expanded', 'false');
        expect(btn).toHaveAttribute('aria-label', 'Agent Canvas');
        expect(screen.queryByTestId('agent-canvas-badge')).not.toBeInTheDocument();
        expect(screen.queryByTestId('agent-canvas-pulse-dot')).not.toBeInTheDocument();
    });

    it('renders with badge and pulse dot when panels exist', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [mockPanel],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="header" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        expect(btn).toHaveAttribute('aria-label', 'Agent Canvas (1 document)');

        const badge = screen.getByTestId('agent-canvas-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('1');

        const pulseDot = screen.getByTestId('agent-canvas-pulse-dot');
        expect(pulseDot).toBeInTheDocument();
    });

    it('displays open state when isCanvasOpen is true', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: true,
                canvasPanels: [mockPanel],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="header" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        expect(btn).toHaveAttribute('aria-expanded', 'true');
    });

    it('calls toggleCanvas when clicked', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [mockPanel],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="header" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        fireEvent.click(btn);

        expect(toggleCanvas).toHaveBeenCalledTimes(1);
    });

    it('renders sidebar variant properly with label', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [mockPanel, { ...mockPanel, id: 'test-panel-2' }],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="sidebar" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        expect(btn).toHaveTextContent('Agent Canvas');
        expect(screen.getByTestId('agent-canvas-badge')).toHaveTextContent('2');
    });

    it('renders compact variant without label', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
            selector({
                isCanvasOpen: false,
                canvasPanels: [],
                toggleCanvas,
            })
        );

        render(<AgentCanvasToggle variant="compact" />);

        const btn = screen.getByTestId('agent-canvas-toggle-btn');
        expect(btn).not.toHaveTextContent('Agent Canvas');
    });
});
