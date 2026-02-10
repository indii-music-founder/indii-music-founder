
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
    // Mock other icons used in the drawer items
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
    FileText: () => <div data-testid="icon-file-text" />,
    ShoppingBag: () => <div data-testid="icon-shopping-bag" />,
    Radio: () => <div data-testid="icon-radio" />,
    Clock: () => <div data-testid="icon-clock" />,
}));

// Mock haptic feedback
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

    it('renders the menu trigger button on mobile', () => {
        render(<MobileNav />);
        const menuButton = screen.getByLabelText('Open Navigation');
        expect(menuButton).toBeInTheDocument();
        expect(screen.getByTestId('icon-menu')).toBeInTheDocument();
    });

    it('opens the navigation drawer when trigger is clicked', async () => {
        render(<MobileNav />);

        const menuButton = screen.getByLabelText('Open Navigation');
        fireEvent.click(menuButton);

        // Expect drawer content to appear
        expect(await screen.findByText("Manager's Office")).toBeInTheDocument();
        expect(screen.getByText('Departments')).toBeInTheDocument();
        expect(screen.getByText('Tools')).toBeInTheDocument();

        // Use regex or exact string match for items
        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
        expect(screen.getByText('Legal Department')).toBeInTheDocument();
    });

    it('navigates and closes drawer when an item is clicked', async () => {
        render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByLabelText('Open Navigation'));

        // Wait for menu to open
        const brandItem = await screen.findByText('Brand Manager');

        // Click Brand Manager
        fireEvent.click(brandItem.closest('button')!);

        // Assert navigation
        expect(mockSetModule).toHaveBeenCalledWith('brand');

        // Assert menu closed (might need waitFor due to exit animation)
        await waitFor(() => {
            expect(screen.queryByText("Manager's Office")).not.toBeInTheDocument();
        });
    });

    it('closes drawer when clicking close button', async () => {
        render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByLabelText('Open Navigation'));
        expect(await screen.findByText("Navigation")).toBeInTheDocument();

        // Click Close X
        const closeButton = screen.getByLabelText('Close menu');
        fireEvent.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByText("Manager's Office")).not.toBeInTheDocument();
        });
    });

    it('closes drawer when clicking backdrop', async () => {
        const { container } = render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByLabelText('Open Navigation'));
        await screen.findByText("Navigation");

        // Find backdrop
        // Based on implementation: className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        // We can query by generic class or aria-hidden if it had it, but implementation has aria-hidden="true"
        // Let's use the click handler attached to the backdrop.
        // The backdrop is the first child of the fixed container

        // Note: The structure is AnimatePresence -> div.fixed -> motion.div(backdrop) -> motion.div(menu)
        // We can look for the element with the backdrop classes
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const backdrop = container.querySelector('.bg-black\\/60');
        expect(backdrop).toBeInTheDocument();

        fireEvent.click(backdrop!);

        await waitFor(() => {
            expect(screen.queryByText("Manager's Office")).not.toBeInTheDocument();
        });
    });

    it('navigates to dashboard when "Return to HQ" is clicked', async () => {
        render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByLabelText('Open Navigation'));

        const returnButton = await screen.findByText('Return to HQ');
        fireEvent.click(returnButton.closest('button')!);

        expect(mockSetModule).toHaveBeenCalledWith('dashboard');
    });
});
