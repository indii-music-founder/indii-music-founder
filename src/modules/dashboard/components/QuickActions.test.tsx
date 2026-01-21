import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickActions from './QuickActions';
import { vi } from 'vitest';

// Mock the store
const mockSetModule = vi.fn();

vi.mock('@/core/store', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore: (selector: any) => {
        // Mock implementation of the selector
        const state = {
            setModule: mockSetModule
        };
        return selector(state);
    }
}));

// Mock icons
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
        Sparkles: () => <div data-testid="icon-sparkles" />,
        Film: () => <div data-testid="icon-film" />,
        Megaphone: () => <div data-testid="icon-megaphone" />,
        Book: () => <div data-testid="icon-book" />,
        GitBranch: () => <div data-testid="icon-gitbranch" />,
    };
});

describe('QuickActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all quick action buttons', () => {
        render(<QuickActions />);

        expect(screen.getByText('Creative Studio')).toBeInTheDocument();
        expect(screen.getByText('Video Production')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
        expect(screen.getByText('Publishing')).toBeInTheDocument();
        expect(screen.getByText('Workflow Lab')).toBeInTheDocument();
    });

    it('calls setModule when a button is clicked', () => {
        render(<QuickActions />);

        fireEvent.click(screen.getByText('Creative Studio'));
        expect(mockSetModule).toHaveBeenCalledWith('creative');

        fireEvent.click(screen.getByText('Video Production'));
        expect(mockSetModule).toHaveBeenCalledWith('video');
    });

    it('wraps buttons in tooltip triggers', () => {
        render(<QuickActions />);

        const button = screen.getByText('Creative Studio').closest('button');
        // Radix UI TooltipTrigger adds data-state="closed" to the trigger element initially
        expect(button).toHaveAttribute('data-state', 'closed');
    });

    it('opens tooltip on hover', async () => {
        const user = userEvent.setup();
        render(<QuickActions />);

        const button = screen.getByText('Creative Studio').closest('button');

        // Trigger hover
        await user.hover(button!);

        // Verify that the trigger state changes to open (delayed-open)
        // This confirms the interaction is registered and the Tooltip logic is active
        await waitFor(() => {
            expect(button).toHaveAttribute('data-state', 'delayed-open');
        });
    });
});
