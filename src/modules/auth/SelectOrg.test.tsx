import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SelectOrg from './SelectOrg';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    }
}));

describe('SelectOrg', () => {
    const mockSetOrganization = vi.fn();
    const mockAddOrganization = vi.fn();
    const mockSetModule = vi.fn();
    const mockInitializeHistory = vi.fn();
    const mockLoadProjects = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue({
            organizations: [
                { id: 'org-1', name: 'Test Org', plan: 'free', members: ['me'] }
            ],
            currentOrganizationId: 'org-1',
            setOrganization: mockSetOrganization,
            addOrganization: mockAddOrganization,
            setModule: mockSetModule,
            initializeHistory: mockInitializeHistory,
            loadProjects: mockLoadProjects,
            getState: () => ({ loadProjects: mockLoadProjects })
        });
    });

    it('renders organization list', () => {
        render(<SelectOrg />);
        expect(screen.getByText('Select Organization')).toBeInTheDocument();
        expect(screen.getByText('Test Org')).toBeInTheDocument();
    });



    it('handles organization selection', async () => {
        render(<SelectOrg />);
        fireEvent.click(screen.getByText('Test Org'));
    });

    it('renders organization without members field without crashing', () => {
        (useStore as any).mockReturnValue({
            organizations: [
                { id: 'org-2', name: 'Corrupt Org', plan: 'free' } // Missing members
            ],
            currentOrganizationId: 'org-1',
            setOrganization: mockSetOrganization,
            addOrganization: mockAddOrganization,
            setModule: mockSetModule,
            initializeHistory: mockInitializeHistory,
            loadProjects: mockLoadProjects,
            getState: () => ({ loadProjects: mockLoadProjects })
        });

        render(<SelectOrg />);
        expect(screen.getByText('Corrupt Org')).toBeInTheDocument();
        // Should default to 0 members
        expect(screen.getByText('0 members')).toBeInTheDocument();
    });
});
