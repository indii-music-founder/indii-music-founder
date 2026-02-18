import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhysicalMediaDesigner } from './PhysicalMediaDesigner';
import { useToast } from '../../core/context/ToastContext';
import { agentRegistry } from '../../services/agent/registry';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../../core/context/ToastContext', () => ({
    useToast: vi.fn()
}));
vi.mock('../../services/agent/registry', () => ({
    agentRegistry: {
        get: vi.fn(),
        getAsync: vi.fn()
    }
}));
// Mock fabric globally to avoid "setLineDash" and other canvas context errors in JSDOM
vi.mock('fabric', () => ({
    Canvas: vi.fn().mockImplementation(() => ({
        setZoom: vi.fn(),
        dispose: vi.fn(),
        clear: vi.fn(),
        add: vi.fn(),
        renderAll: vi.fn(),
    })),
    Rect: vi.fn(),
    Line: vi.fn(),
    Text: vi.fn(),
}));

// Mock PhysicalMediaLayout as a fallback
vi.mock('./components/PhysicalMediaLayout', () => ({
    PhysicalMediaLayout: ({ template }: any) => (
        <div data-testid="canvas-mock">
            Canvas for {template?.name}
        </div>
    )
}));

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Sparkles: (props: any) => <div data-testid="icon-sparkles" {...props} />,
    Send: (props: any) => <div data-testid="icon-send" {...props} />,
    ZoomIn: (props: any) => <div data-testid="icon-zoom-in" {...props} />,
    ZoomOut: (props: any) => <div data-testid="icon-zoom-out" {...props} />,
    Maximize: (props: any) => <div data-testid="icon-maximize" {...props} />,
    ArrowLeft: (props: any) => <div data-testid="icon-arrow-left" {...props} />,
    Layers: (props: any) => <div data-testid="icon-layers" {...props} />,
    Palette: (props: any) => <div data-testid="icon-palette" {...props} />,
    Disc: (props: any) => <div data-testid="icon-disc" {...props} />,
    GripVertical: (props: any) => <div data-testid="icon-grip" {...props} />,
    Eye: (props: any) => <div data-testid="icon-eye" {...props} />,
    EyeOff: (props: any) => <div data-testid="icon-eye-off" {...props} />,
    Lock: (props: any) => <div data-testid="icon-lock" {...props} />,
    Unlock: (props: any) => <div data-testid="icon-unlock" {...props} />,
    Zap: (props: any) => <div data-testid="icon-zap" {...props} />,
}));

// Mock motion to filter out motion specific props like layoutId
vi.mock('motion', async () => {
    const actual = await vi.importActual('motion');
    return {
        ...actual,
        motion: {
            div: ({ children, layoutId, initial, animate, exit, transition, ...props }: any) => (
                <div {...props}>{children}</div>
            ),
            button: ({ children, layoutId, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) => (
                <button {...props}>{children}</button>
            ),
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    };
});

describe('PhysicalMediaDesigner (Project Sonic Edition)', () => {
    const mockToast = {
        success: vi.fn(),
        error: vi.fn(),
    };

    beforeEach(() => {
        (useToast as any).mockReturnValue(mockToast);
        vi.clearAllMocks();
    });

    test('renders initial empty state/format selector', () => {
        render(<PhysicalMediaDesigner />);
        expect(screen.getByText('Format')).toBeInTheDocument();
        expect(screen.getByText(/CD Front Cover/)).toBeInTheDocument();
    });

    test('selecting a template reveals the workspace', async () => {
        render(<PhysicalMediaDesigner />);

        // Find and click a template
        const templateBtn = screen.getByText(/CD Front Cover/);
        fireEvent.click(templateBtn);

        // Check if workspace title appears
        const titleMatches = screen.getAllByText(/CD Front Cover/);
        expect(titleMatches.length).toBeGreaterThan(0);

        // Check if new panels appear
        expect(screen.getByText('Change Template')).toBeInTheDocument();
    });

    test('DesignToolbar interactions', () => {
        render(<PhysicalMediaDesigner />);
        fireEvent.click(screen.getByText(/CD Front Cover/));

        // Check for toolbar tools
        expect(screen.getByTitle('Select')).toBeInTheDocument();
        expect(screen.getByTitle('Text')).toBeInTheDocument();
        expect(screen.getByTitle('Image')).toBeInTheDocument();

        // AI Synthesis button
        const aiBtn = screen.getByTitle('AI Synthesis');
        expect(aiBtn).toBeInTheDocument();

        fireEvent.click(aiBtn);
    });

    test('LayerPanel interactions', () => {
        render(<PhysicalMediaDesigner />);
        fireEvent.click(screen.getByText(/CD Front Cover/));

        // Switch to Layers tab check - using getAll because it appears in tab and panel
        expect(screen.getAllByText('Layers').length).toBeGreaterThan(0);

        // Check default layers
        expect(screen.getByText('Title Text')).toBeInTheDocument();
        expect(screen.getByText('Background')).toBeInTheDocument();

        const titleText = screen.getByText('Title Text');
        fireEvent.click(titleText);
    });

    test('Creative Director chat interaction', async () => {
        const mockExecute = vi.fn().mockResolvedValue({ text: "I'm the director, let's make it iconic." });
        const mockAgent = { execute: mockExecute };
        (agentRegistry.getAsync as any).mockResolvedValue(mockAgent);

        render(<PhysicalMediaDesigner />);
        // Click the first appearance of the template text (the selector)
        fireEvent.click(screen.getAllByText(/CD Front Cover/)[0]);

        // Switch to Director tab - use role to be specific
        fireEvent.click(screen.getByRole('button', { name: /Director AI/i }));

        const input = await screen.findByPlaceholderText(/Ask specifically for gold/i);
        fireEvent.change(input, { target: { value: 'Make it pop' } });
        fireEvent.click(screen.getByTestId('send-message-button'));

        // Wait for response
        const response = await screen.findByText(/iconic/i, {}, { timeout: 5000 });
        expect(response).toBeInTheDocument();

        expect(mockExecute).toHaveBeenCalled();
    });
});
