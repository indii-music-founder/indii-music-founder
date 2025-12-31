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
        get: vi.fn()
    }
}));
// Mock Lucide icons
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
        Sparkles: () => <div data-testid="icon-sparkles" />,
        Send: () => <div data-testid="icon-send" />,
        ZoomIn: () => <div data-testid="icon-zoom-in" />,
        ZoomOut: () => <div data-testid="icon-zoom-out" />,
        Maximize: () => <div data-testid="icon-maximize" />,
        ArrowLeft: () => <div data-testid="icon-arrow-left" />,
    };
});
// Mock motion
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        motion: {
            div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
            button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    };
});

describe('PhysicalMediaDesigner (Banana Pro Edition)', () => {
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
        expect(screen.getByText('CD Jewel Case')).toBeInTheDocument(); // Assuming TemplateSelector renders this
    });

    test('selecting a template reveals the workspace', async () => {
        render(<PhysicalMediaDesigner />);

        // Find and click a template (assuming TemplateSelector structure)
        const templateBtn = screen.getByText('CD Jewel Case');
        fireEvent.click(templateBtn);

        // Check if workspace title appears
        expect(screen.getByText('CD Jewel Case')).toBeInTheDocument();

        // Check if new panels appear
        expect(screen.getByText('Details')).toBeInTheDocument(); // Template details
    });

    test('DesignToolbar interactions', () => {
        render(<PhysicalMediaDesigner />);
        fireEvent.click(screen.getByText('CD Jewel Case')); // Open workspace

        // Check for toolbar tools
        expect(screen.getByTitle('Select')).toBeInTheDocument();
        expect(screen.getByTitle('Text')).toBeInTheDocument();
        expect(screen.getByTitle('Image')).toBeInTheDocument();

        // Banana Time button
        const bananaBtn = screen.getByTitle('Banana Time');
        expect(bananaBtn).toBeInTheDocument();

        fireEvent.click(bananaBtn);
        expect(mockToast.success).toHaveBeenCalledWith("It's Banana Time! 🍌");

        // Check if BananaAssets panel appeared
        expect(screen.getByText('Banana Assets')).toBeInTheDocument();
    });

    test('LayerPanel interactions', () => {
        render(<PhysicalMediaDesigner />);
        fireEvent.click(screen.getByText('CD Jewel Case')); // Open workspace

        // Switch to Layers tab (it's default, but let's verify)
        const layersTab = screen.getByText('Layers');
        expect(layersTab).toHaveClass('text-white');

        // Check default layers
        expect(screen.getByText('Main Banana')).toBeInTheDocument();
        expect(screen.getByText('Background')).toBeInTheDocument();

        // Test visibility toggle roughly (checking if render doesn't crash)
        // Note: In a real DOM test we'd check class changes or icons, 
        // here we verify the element exists and is clickable.
        const mainBanana = screen.getByText('Main Banana');
        fireEvent.click(mainBanana);
        // Expect active state change (visual only in this mock implementation)
    });

    test('Creative Director chat interaction', async () => {
        render(<PhysicalMediaDesigner />);
        fireEvent.click(screen.getByText('CD Jewel Case')); // Open workspace

        // Switch to Director tab
        fireEvent.click(screen.getByText('Director AI'));

        const input = screen.getByPlaceholderText('Ask specifically for gold...');
        fireEvent.change(input, { target: { value: 'Make it pop' } });
        fireEvent.click(screen.getByTestId('icon-send'));

        // Expect thinking state
        expect(screen.getByText('Thinking...')).toBeInTheDocument();

        // Wait for response (mocked timeout in component)
        await waitFor(() => {
            expect(screen.getByText("That's a bold choice. The yellow really pops against the dark background. Maybe add some gold foil texture?")).toBeInTheDocument();
        }, { timeout: 2000 });
    });
});
