import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    it('starts navigation sections open and closes them on request', async () => {
        render(<Sidebar />);

        const managerSection = screen.getByTestId('manager-section');
        const managerToggle = screen.getByRole('button', { name: "Manager's Office" });

        expect(managerToggle).toHaveAttribute('aria-expanded', 'true');
        // ISSUE-1442 Stage 2: Brand Manager folded into Marketing tabs — Road/tour
        // is the surviving Manager's Office assertion target.
        const roadTourBtn = screen.getByText('Road/tour');
        expect(managerSection.contains(roadTourBtn)).toBe(true);

        fireEvent.click(managerToggle);

        expect(managerToggle).toHaveAttribute('aria-expanded', 'false');
        await waitFor(() => {
            expect(screen.queryByText('Road/tour')).not.toBeInTheDocument();
        });
    });

    it('Road/tour button is clickable', () => {
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
        const roadTourBtn = screen.getByText('Road/tour');

        // Click the button (parent button element)
        fireEvent.click(roadTourBtn.closest('button')!);

        expect(setModule).toHaveBeenCalledWith('road');
    });

    // ISSUE-1269: the god_mode Command Center pill was removed. It routed to the
    // `observability` ops dashboard while sharing its name with the artist-facing
    // Command Center tab in the agent workspace. It must not come back for ANY user.
    it('never shows the removed Command Center pill, even in god mode', () => {
        mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });
        const setModule = vi.fn();
        (useStore as any).mockReturnValue({
            currentModule: 'dashboard',
            setModule,
            isSidebarOpen: true,
            toggleSidebar: vi.fn(),
        });

        render(<Sidebar />);

        expect(screen.queryByTestId('command-center-btn')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Command Center' })).not.toBeInTheDocument();
        expect(screen.queryByText('Live system overview')).not.toBeInTheDocument();
        expect(setModule).not.toHaveBeenCalledWith('observability');
    });

    it('provides accessible labels when sidebar is collapsed', () => {
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
        const roadTourBtn = screen.getByTestId('nav-item-road');
        expect(roadTourBtn).toHaveAttribute('aria-label', 'Road/tour');

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
