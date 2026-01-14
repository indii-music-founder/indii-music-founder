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

    it('renders Reference Assets in the Manager section', () => {
        render(<Sidebar />);

        const managerSection = screen.getByTestId('manager-section');
        const refAssetsBtn = screen.getByText('Reference Assets');

        // Check if Reference Assets button exists
        expect(refAssetsBtn).toBeTruthy();

        // Verify it is inside the manager section
        expect(managerSection.contains(refAssetsBtn)).toBe(true);
    });

    it('Reference Assets button is clickable', () => {
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
        const refAssetsBtn = screen.getByText('Reference Assets');

        // Click the button (parent button element)
        fireEvent.click(refAssetsBtn.closest('button')!);

        expect(setModule).toHaveBeenCalledWith('reference-manager');
    });
});
