
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileNav } from './MobileNav';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('lucide-react', () => ({
    Home: () => <div data-testid="icon-home" />,
    Layout: () => <div data-testid="icon-layout" />,
    MessageSquare: () => <div data-testid="icon-messages" />,
    Book: () => <div data-testid="icon-book" />,
    MoreHorizontal: () => <div data-testid="icon-more" />,
    Music: () => <div data-testid="icon-music" />,
    Workflow: () => <div data-testid="icon-workflow" />,
    Scale: () => <div data-testid="icon-scale" />,
    DollarSign: () => <div data-testid="icon-dollar" />,
    X: () => <div data-testid="icon-x" />,
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

    it('renders primary tabs on mobile', () => {
        render(<MobileNav />);

        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText('Studio')).toBeInTheDocument();
        expect(screen.getByText('Market')).toBeInTheDocument();
        expect(screen.getByText('Brain')).toBeInTheDocument();
        expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('opens overflow menu when "More" is clicked', () => {
        render(<MobileNav />);

        const moreButton = screen.getByText('More').closest('button');
        fireEvent.click(moreButton!);

        expect(screen.getByText('More Features')).toBeInTheDocument();
        expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    it('navigates when a primary tab is clicked', () => {
        render(<MobileNav />);

        const homeButton = screen.getByText('Home').closest('button');
        fireEvent.click(homeButton!);

        expect(mockSetModule).toHaveBeenCalledWith('dashboard');
    });

    it('navigates and closes overflow menu when a secondary tab is clicked', () => {
        render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByText('More').closest('button')!);

        // Click Finance
        const financeButton = screen.getByText('Finance').closest('button');
        fireEvent.click(financeButton!);

        // Assert navigation
        expect(mockSetModule).toHaveBeenCalledWith('finance');

        // Assert menu closed
        expect(screen.queryByText('More Features')).not.toBeInTheDocument();
    });

    it('closes overflow menu when clicking the X button', () => {
        render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByText('More').closest('button')!);
        expect(screen.getByText('More Features')).toBeInTheDocument();

        // Click X (we mocked it with testid icon-x)
        const closeButton = screen.getByTestId('icon-x').closest('button');
        fireEvent.click(closeButton!);

        expect(screen.queryByText('More Features')).not.toBeInTheDocument();
    });

    it('closes overflow menu when clicking the backdrop', () => {
        const { container } = render(<MobileNav />);

        // Open menu
        fireEvent.click(screen.getByText('More').closest('button')!);

        // Find backdrop by class since it doesn't have a test-id or text
        // The backdrop is the first child of the fixed container
        const backdrop = container.querySelector('.bg-black\\/60');
        expect(backdrop).toBeInTheDocument();

        fireEvent.click(backdrop!);

        expect(screen.queryByText('More Features')).not.toBeInTheDocument();
    });
});
