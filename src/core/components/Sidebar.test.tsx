
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar';
import { useStore } from '../store';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Briefcase: () => <span>Briefcase</span>,
    Users: () => <span>Users</span>,
    Megaphone: () => <span>Megaphone</span>,
    Network: () => <span>Network</span>,
    Mic: () => <span>Mic</span>,
    Palette: () => <span>Palette</span>,
    Film: () => <span>Film</span>,
    Scale: () => <span>Scale</span>,
    Book: () => <span>Book</span>,
    DollarSign: () => <span>DollarSign</span>,
    FileText: () => <span>FileText</span>,
    ShoppingBag: () => <span>ShoppingBag</span>,
    Radio: () => <span>Radio</span>,
    Clock: () => <span>Clock</span>,
    Layout: () => <span>Layout</span>,
    ChevronLeft: () => <span>ChevronLeft</span>,
    ChevronRight: () => <span>ChevronRight</span>,
    LogOut: () => <span>LogOut</span>,
    Activity: () => <span>Activity</span>
}));

// Mock UI components
vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    Tooltip: ({ children }: any) => <div>{children}</div>,
    TooltipTrigger: ({ children }: any) => <div>{children}</div>,
    TooltipContent: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/core/components/ui/ThemeToggle', () => ({
    ThemeToggle: () => <div>ThemeToggle</div>
}));

vi.mock('@/core/components/ui/BiometricToggle', () => ({
    BiometricToggle: () => <div>BiometricToggle</div>
}));

// Mock Store
vi.mock('../store', () => ({
    useStore: vi.fn()
}));

// Mock theme colors
vi.mock('../theme/moduleColors', () => ({
    getColorForModule: () => ({
        cssVar: '--color-test',
        text: 'text-test',
        bg: 'bg-test',
        hoverText: 'hover:text-test',
        hoverBg: 'hover:bg-test'
    })
}));

describe('Sidebar Component', () => {
    const mockSetModule = vi.fn();
    const mockToggleSidebar = vi.fn();
    const mockLogout = vi.fn();

    const defaultStore = {
        currentModule: 'dashboard',
        setModule: mockSetModule,
        isSidebarOpen: true,
        toggleSidebar: mockToggleSidebar,
        userProfile: { bio: 'Test User' },
        logout: mockLogout
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockImplementation((selector: any) => selector(defaultStore));
    });

    it('should render all sections when open', () => {
        render(<Sidebar />);

        expect(screen.getByText("Manager's Office")).toBeInTheDocument();
        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
        expect(screen.getByText("Departments")).toBeInTheDocument();
        expect(screen.getByText("Tools")).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('made by Detroit, for the world.')).toBeInTheDocument();
    });

    it('should collapsed view when closed', () => {
        vi.mocked(useStore).mockImplementation((selector: any) => selector({
            ...defaultStore,
            isSidebarOpen: false
        }));

        render(<Sidebar />);

        expect(screen.queryByText("Manager's Office")).not.toBeInTheDocument();
        // Icons should still be there
        expect(screen.getAllByText('Briefcase')[0]).toBeInTheDocument();
    });

    it('should navigate when item clicked', () => {
        render(<Sidebar />);

        const brandLink = screen.getByText('Brand Manager').closest('button');
        fireEvent.click(brandLink!);

        expect(mockSetModule).toHaveBeenCalledWith('brand');
    });

    it('should toggle sidebar', () => {
        render(<Sidebar />);

        const toggleBtn = screen.getByTestId('sidebar-toggle');
        fireEvent.click(toggleBtn);

        expect(mockToggleSidebar).toHaveBeenCalled();
    });

    it('should handle logout', () => {
        render(<Sidebar />);

        const logoutBtn = screen.getByTestId('logout-btn');
        fireEvent.click(logoutBtn);

        expect(mockLogout).toHaveBeenCalled();
    });
});
