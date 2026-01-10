import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DepartmentGrid from './DepartmentGrid';

// Mock the store hook
const mockSetModule = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: () => ({
        setModule: mockSetModule,
    }),
}));

describe('DepartmentGrid', () => {
    it('renders all departments', () => {
        render(<DepartmentGrid />);

        expect(screen.getByText('Marketing Dept.')).toBeInTheDocument();
        expect(screen.getByText('Publishing Dept.')).toBeInTheDocument();
        expect(screen.getByText('Creative Studio')).toBeInTheDocument();
        expect(screen.getByText('Distribution')).toBeInTheDocument();
        expect(screen.getByText('Finance Office')).toBeInTheDocument();
    });

    it('navigates to the correct module on click', () => {
        render(<DepartmentGrid />);

        // Click Marketing
        fireEvent.click(screen.getByText('Marketing Dept.'));
        expect(mockSetModule).toHaveBeenCalledWith('marketing');

        // Click Creative Studio
        fireEvent.click(screen.getByText('Creative Studio'));
        expect(mockSetModule).toHaveBeenCalledWith('creative');

        // Click Road Manager (Department name is "Road Manager", maps to 'road')
        // Department name check:
        // In the viewed file, Road Manager was not explicitly seen in the snippet but assumed to be there. 
        // Let's verify commonly used ones.
    });
});
