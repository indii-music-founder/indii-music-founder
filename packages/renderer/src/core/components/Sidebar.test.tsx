import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';
import { useStore } from '../store';

// Mock dependencies
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

vi.mock('./sidebar/ProjectList', () => ({
    ProjectList: () => <div data-testid="project-list">Project List</div>,
}));

vi.mock('../theme/moduleColors', () => ({
    getColorForModule: () => ({
        cssVar: '--color-test',
        text: 'text-test',
        bg: 'bg-test',
        hoverText: 'hover:text-test',
        hoverBg: 'hover:bg-test',
    }),
}));

// Mock useGodMode — default to false (non-god user), tests that need it override
const mockUseGodMode = vi.fn().mockReturnValue({ isGodMode: false, loading: false });
vi.mock('@/hooks/useGodMode', () => ({
    useGodMode: () => mockUseGodMode(),
}));

describe('Sidebar', () => {
    beforeEach(() => {
        mockUseGodMode.mockReturnValue({ isGodMode: false, loading: false });
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule: vi.fn(),
            isSidebarOpen: true,
            toggleSidebar: vi.fn(),
            userProfile: { bio: 'Test User' },
            logout: vi.fn(),
            setTheme: vi.fn(),
        });
    });

    it('starts navigation sections closed and opens them on request', () => {
        render(<Sidebar />);

        const managerSection = screen.getByTestId('manager-section');
        const managerToggle = screen.getByRole('button', { name: "Manager's Office" });

        expect(managerToggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Brand Manager')).not.toBeInTheDocument();

        fireEvent.click(managerToggle);
        const brandManagerBtn = screen.getByText('Brand Manager');

        expect(managerToggle).toHaveAttribute('aria-expanded', 'true');
        expect(managerSection.contains(brandManagerBtn)).toBe(true);
    });

    it('Brand Manager button is clickable', () => {
        const setModule = vi.fn();
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule,
            isSidebarOpen: true,
            toggleSidebar: vi.fn(),
            userProfile: { bio: 'Test User' },
            logout: vi.fn(),
            setTheme: vi.fn(),
        });

        render(<Sidebar />);
        fireEvent.click(screen.getByRole('button', { name: "Manager's Office" }));
        const brandManagerBtn = screen.getByText('Brand Manager');

        // Click the button (parent button element)
        fireEvent.click(brandManagerBtn.closest('button')!);

        expect(setModule).toHaveBeenCalledWith('brand');
    });

    it('hides Command Center from non-god-mode users', () => {
        mockUseGodMode.mockReturnValue({ isGodMode: false, loading: false });

        render(<Sidebar />);

        expect(screen.queryByRole('button', { name: 'Command Center' })).not.toBeInTheDocument();
        expect(screen.queryByText('Live system overview')).not.toBeInTheDocument();
    });

    it('shows Command Center to god-mode users and navigates on click', () => {
        mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });
        const setModule = vi.fn();
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule,
            isSidebarOpen: true,
            toggleSidebar: vi.fn(),
        });

        render(<Sidebar />);

        expect(screen.getByRole('button', { name: 'Command Center' })).toBeVisible();
        expect(screen.getByText('Live system overview')).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Command Center' }));
        expect(setModule).toHaveBeenCalledWith('observability');
    });

    it('provides accessible labels when sidebar is collapsed', () => {
        // god_mode true so Command Center renders
        mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule: vi.fn(),
            isSidebarOpen: false, // Collapsed state
            toggleSidebar: vi.fn(),
            userProfile: { bio: 'Test User' },
            logout: vi.fn(),
            setTheme: vi.fn(),
        });

        render(<Sidebar />);

        // Check for navigation item aria-label
        const brandManagerBtn = screen.getByTestId('nav-item-brand');
        expect(brandManagerBtn).toHaveAttribute('aria-label', 'Brand Manager');
        expect(screen.getByTestId('command-center-btn')).toHaveAttribute('aria-label', 'Command Center');

        // Check sidebar toggle is accessible in collapsed state
        expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });

    // Snapshot tests — god_mode OFF (default user view)
    it('matches snapshot in expanded state', () => {
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule: vi.fn(),
            isSidebarOpen: true,
            toggleSidebar: vi.fn(),
            userProfile: { bio: 'Test User' },
            logout: vi.fn(),
            setTheme: vi.fn(),
        });
        const { container } = render(<Sidebar />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot in collapsed state', () => {
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule: vi.fn(),
            isSidebarOpen: false,
            toggleSidebar: vi.fn(),
            userProfile: { bio: 'Test User' },
            logout: vi.fn(),
            setTheme: vi.fn(),
        });
        const { container } = render(<Sidebar />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
