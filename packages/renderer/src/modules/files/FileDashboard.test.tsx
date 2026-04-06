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
vi.mock('@/lib/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }));
vi.mock('@/services/FileSystemService', () => ({ FileNode: {} }));

import FileDashboard from './FileDashboard';
import { NavItem } from './components/NavItem';
import { DetailRow } from './components/DetailRow';

describe('FileDashboard', () => {
    beforeEach(() => {
        mockStore = {
            fileNodes: [],
            currentProjectId: 'proj-1',
            selectedFileNodeId: null,
            setSelectedFileNode: vi.fn(),
        };
    });

    it('renders the title and upload button', () => {
        render(<FileDashboard />);
        expect(screen.getByText('ASSETS')).toBeInTheDocument();
        expect(screen.getByText('Upload Asset')).toBeInTheDocument();
    });

    it('shows "Select a project" when no project', () => {
        mockStore = { ...mockStore, currentProjectId: null };
        render(<FileDashboard />);
        expect(screen.getByText('Select a project to view files')).toBeInTheDocument();
    });

    it('renders sidebar nav items', () => {
        render(<FileDashboard />);
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Favorites')).toBeInTheDocument();
        expect(screen.getByText('Images')).toBeInTheDocument();
    });
});

describe('NavItem', () => {
    it('renders label and count', () => {
        render(<NavItem icon={() => <span>I</span>} label="Test" count={5} active />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });
});

describe('DetailRow', () => {
    it('renders label and value', () => {
        render(<DetailRow label="Type" value="Image" />);
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Image')).toBeInTheDocument();
    });
});
