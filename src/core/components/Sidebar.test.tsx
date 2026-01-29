import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';
import { useStore } from '../store';

// Mock dependencies
vi.mock('../store', () => ({
    useStore: vi.fn(),
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

describe('Sidebar', () => {
    beforeEach(() => {
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

    it('renders Brand Manager in the Manager section', () => {
        render(<Sidebar />);

        const managerSection = screen.getByTestId('manager-section');
        const brandManagerBtn = screen.getByText('Brand Manager');

        // Check if Brand Manager button exists
        expect(brandManagerBtn).toBeTruthy();

        // Verify it is inside the manager section
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
        const brandManagerBtn = screen.getByText('Brand Manager');

        // Click the button (parent button element)
        fireEvent.click(brandManagerBtn.closest('button')!);

        expect(setModule).toHaveBeenCalledWith('brand');
    });

    it('provides accessible labels when sidebar is collapsed', () => {
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

        // Check for logout button
        expect(screen.getByTestId('logout-btn')).toHaveAttribute('aria-label', 'Reload System');
    });
});
