
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileNav } from './MobileNav';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Menu: () => <div data-testid="icon-menu" />,
    X: () => <div data-testid="icon-x" />,
    Layout: () => <div data-testid="icon-layout" />,
    Briefcase: () => <div data-testid="icon-briefcase" />,
    Users: () => <div data-testid="icon-users" />,
    Megaphone: () => <div data-testid="icon-megaphone" />,
    Network: () => <div data-testid="icon-network" />,
    Mic: () => <div data-testid="icon-mic" />,
    Palette: () => <div data-testid="icon-palette" />,
    Film: () => <div data-testid="icon-film" />,
    Scale: () => <div data-testid="icon-scale" />,
    Book: () => <div data-testid="icon-book" />,
    DollarSign: () => <div data-testid="icon-dollar" />,
    ShoppingBag: () => <div data-testid="icon-shopping-bag" />,
    Radio: () => <div data-testid="icon-radio" />,
    Clock: () => <div data-testid="icon-clock" />,
    FileText: () => <div data-testid="icon-file-text" />,
    Globe: () => <div data-testid="icon-globe" />,
}));
// Mock mobile haptics
vi.mock('@/lib/mobile', () => ({
    haptic: vi.fn(),
}));

describe('📱 Viewport: MobileNav Responsiveness', () => {
    let mockSetModule: any;
    let mockStoreState: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSetModule = vi.fn();
        mockStoreState = {
            currentModule: 'dashboard',
            setModule: mockSetModule,
        };

        // Mock useStore selector behavior
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });

        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('renders FAB button initially and drawer is hidden', () => {
        render(<MobileNav />);

        // Check for FAB button
        const faButton = screen.getByLabelText('Open Navigation');
        expect(faButton).toBeInTheDocument();
        expect(screen.getByTestId('icon-menu')).toBeInTheDocument();

        // Check drawer is NOT visible
        expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
        expect(screen.queryByText('Return to HQ')).not.toBeInTheDocument();
    });

    it('opens drawer when FAB is clicked', async () => {
        render(<MobileNav />);

        const faButton = screen.getByLabelText('Open Navigation');
        fireEvent.click(faButton);

        // Check drawer content appears
        await waitFor(() => {
            expect(screen.getByText('Navigation')).toBeInTheDocument();
        });

        expect(screen.getByText('Return to HQ')).toBeInTheDocument();
        expect(screen.getByText("Manager's Office")).toBeInTheDocument();
        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
    });

    it('navigates when an item is clicked', async () => {
        render(<MobileNav />);

        // Open drawer
        fireEvent.click(screen.getByLabelText('Open Navigation'));
        await waitFor(() => expect(screen.getByText('Brand Manager')).toBeInTheDocument());

        // Click Brand Manager
        fireEvent.click(screen.getByText('Brand Manager'));

        expect(mockSetModule).toHaveBeenCalledWith('brand');

        // Drawer should close (wait for animation/state update)
        await waitFor(() => {
            expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
        });
    });

    it('closes drawer when clicking X button', async () => {
        render(<MobileNav />);

        // Open drawer
        fireEvent.click(screen.getByLabelText('Open Navigation'));
        await waitFor(() => expect(screen.getByLabelText('Close menu')).toBeInTheDocument());

        // Click Close
        fireEvent.click(screen.getByLabelText('Close menu'));

        await waitFor(() => {
            expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
        });
    });

    it('closes drawer when clicking backdrop', async () => {
        const { container } = render(<MobileNav />);

        // Open drawer
        fireEvent.click(screen.getByLabelText('Open Navigation'));
        await waitFor(() => expect(screen.getByText('Navigation')).toBeInTheDocument());

        // Find backdrop (it has aria-hidden=true and onclick handler)
        // Usually backdrop is the first child in the portal or absolute overlay
        // Looking at code: className="absolute inset-0 bg-black/60 ..."
        // It doesn't have a stable selector other than class or aria-hidden="true" (but aria-hidden might apply to others)
        // The implementation has aria-hidden="true".

        // Let's rely on class selection for the backdrop div
        const backdrop = container.querySelector('.bg-black\\/60');
        expect(backdrop).toBeInTheDocument();

        fireEvent.click(backdrop!);

        await waitFor(() => {
            expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
        });
    });
});
