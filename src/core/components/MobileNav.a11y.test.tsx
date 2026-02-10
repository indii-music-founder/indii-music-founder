
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MobileNav } from './MobileNav';
import { useStore } from '@/core/store';

// Extend expect with jest-axe
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/lib/mobile', () => ({
    haptic: vi.fn(),
}));

// Mock lucide icons to avoid rendering issues and keep DOM clean
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Briefcase: () => <svg role="img" aria-hidden="true" data-testid="icon-briefcase" />,
    Users: () => <svg role="img" aria-hidden="true" data-testid="icon-users" />,
    Megaphone: () => <svg role="img" aria-hidden="true" data-testid="icon-megaphone" />,
    Network: () => <svg role="img" aria-hidden="true" data-testid="icon-network" />,
    Mic: () => <svg role="img" aria-hidden="true" data-testid="icon-mic" />,
    Palette: () => <svg role="img" aria-hidden="true" data-testid="icon-palette" />,
    Film: () => <svg role="img" aria-hidden="true" data-testid="icon-film" />,
    Image: () => <svg role="img" aria-hidden="true" data-testid="icon-image" />,
    Scale: () => <svg role="img" aria-hidden="true" data-testid="icon-scale" />,
    Book: () => <svg role="img" aria-hidden="true" data-testid="icon-book" />,
    DollarSign: () => <svg role="img" aria-hidden="true" data-testid="icon-dollar-sign" />,
    FileText: () => <svg role="img" aria-hidden="true" data-testid="icon-file-text" />,
    ShoppingBag: () => <svg role="img" aria-hidden="true" data-testid="icon-shopping-bag" />,
    Radio: () => <svg role="img" aria-hidden="true" data-testid="icon-radio" />,
    Globe: () => <svg role="img" aria-hidden="true" data-testid="icon-globe" />,
    Menu: () => <svg role="img" aria-hidden="true" data-testid="icon-menu" />,
    X: () => <svg role="img" aria-hidden="true" data-testid="icon-x" />,
    Layout: () => <svg role="img" aria-hidden="true" data-testid="icon-layout" />,
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('♿ MobileNav Accessibility', () => {
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

        // Set Viewport to Mobile
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('should have no accessibility violations in closed state', async () => {
        const { container } = render(<MobileNav />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in open state', async () => {
        const user = userEvent.setup();
        const { container } = render(<MobileNav />);

        const fab = screen.getByRole('button', { name: /open navigation/i });
        await user.click(fab);

        // Wait for animation if necessary (using findBy)
        const closeButton = await screen.findByRole('button', { name: /close menu/i });
        expect(closeButton).toBeInTheDocument();

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should manage focus correctly', async () => {
        const user = userEvent.setup();
        render(<MobileNav />);

        const fab = screen.getByRole('button', { name: /open navigation/i });

        // Open menu
        await user.click(fab);
        const closeButton = await screen.findByRole('button', { name: /close menu/i });

        // Expect focus to be inside the modal (ideally on the close button or first element)
        expect(document.activeElement).toBe(closeButton);

        // Close menu
        await user.click(closeButton);

        // Expect focus to return to FAB
        expect(document.activeElement).toBe(fab);
    });

    it('should close on Escape key', async () => {
        const user = userEvent.setup();
        render(<MobileNav />);

        const fab = screen.getByRole('button', { name: /open navigation/i });
        await user.click(fab);

        await screen.findByRole('button', { name: /close menu/i });

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
        // And focus restoration
        expect(document.activeElement).toBe(fab);
    });

    it('should have proper ARIA attributes', async () => {
        const user = userEvent.setup();
        render(<MobileNav />);

        const fab = screen.getByRole('button', { name: /open navigation/i });

        // Before open
        expect(fab).toHaveAttribute('aria-expanded', 'false');
        expect(fab).toHaveAttribute('aria-controls');

        await user.click(fab);

        // After open
        expect(fab).toHaveAttribute('aria-expanded', 'true');

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby');
    });
});
