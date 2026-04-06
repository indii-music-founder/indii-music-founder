import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

let mockStore: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({ useStore: (s: (st: Record<string, unknown>) => unknown) => s(mockStore) }));
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }));

import SelectOrg from './SelectOrg';

describe('SelectOrg', () => {
    beforeEach(() => {
        mockStore = {
            organizations: [
                { id: 'org-1', name: 'Test Studio', plan: 'pro', members: ['user-1'] },
            ],
            currentOrganizationId: 'org-1',
            setOrganization: vi.fn(),
            addOrganization: vi.fn(),
            setModule: vi.fn(),
            logout: vi.fn(),
            userProfile: { displayName: 'Test User' },
            currentModule: 'select-org',
        };
    });

    it('renders the studio list when organizations exist', () => {
        render(<SelectOrg />);
        expect(screen.getByText('Active Studios')).toBeInTheDocument();
        expect(screen.getByText('Test Studio')).toBeInTheDocument();
    });

    it('shows the create studio option', () => {
        render(<SelectOrg />);
        expect(screen.getByText('Provide New Studio')).toBeInTheDocument();
    });

    it('renders the create form when no orgs exist', () => {
        mockStore = { ...mockStore, organizations: [] };
        render(<SelectOrg />);
        expect(screen.getByText('Create New Studio')).toBeInTheDocument();
        expect(screen.getByText('Provision Studio')).toBeInTheDocument();
    });

    it('shows sign out button', () => {
        render(<SelectOrg />);
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
});
