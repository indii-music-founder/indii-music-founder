import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { File } from 'lucide-react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

let mockStore: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({
    useStore: Object.assign((selector: (state: Record<string, unknown>) => unknown) => selector(mockStore), {
        getState: () => mockStore,
    }),
}));
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
            fetchFileNodes: vi.fn().mockResolvedValue(undefined),
            setModule: vi.fn(),
        };
    });

    it('renders the title without the removed Upload Asset dead affordance', () => {
        render(<FileDashboard />);
        expect(screen.getByText('ASSETS')).toBeInTheDocument();
        expect(screen.queryByText('Upload Asset')).not.toBeInTheDocument();
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

    it('loads the selected project files when opened', () => {
        render(<FileDashboard />);
        expect(mockStore.fetchFileNodes).toHaveBeenCalledWith('proj-1');
    });

    it('offers the existing Creative Studio route when the project vault is empty', () => {
        render(<FileDashboard />);
        expect(screen.getByRole('heading', { name: 'No project files yet' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Open Creative Studio' }));
        expect(mockStore.setModule).toHaveBeenCalledWith('creative');
    });

    it('labels view controls and lets users clear a search with no matches', () => {
        render(<FileDashboard />);
        const grid = screen.getByRole('button', { name: 'Grid view' });
        const list = screen.getByRole('button', { name: 'List view' });
        expect(grid).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(list);
        expect(list).toHaveAttribute('aria-pressed', 'true');

        const search = screen.getByRole('searchbox', { name: 'Search project files' });
        fireEvent.change(search, { target: { value: 'missing' } });
        expect(screen.getByRole('heading', { name: 'No matching files' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
        expect(search).toHaveValue('');
        expect(screen.getByRole('heading', { name: 'No project files yet' })).toBeVisible();
    });

    it('reports a failed read and retries the selected project', () => {
        mockStore.fileNodesLoadError = 'Permission denied';
        render(<FileDashboard />);
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load project files.');
        expect(screen.queryByText('No project files yet')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(mockStore.fetchFileNodes).toHaveBeenNthCalledWith(2, 'proj-1');
    });

    it('keeps the vault visible after a mutation error', () => {
        mockStore.fileSystemError = 'Could not rename file';
        render(<FileDashboard />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'No project files yet' })).toBeVisible();
    });

    it('indicates that project files are loading', () => {
        mockStore.isFileSystemLoading = true;
        render(<FileDashboard />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading project files');
        expect(screen.queryByText('No project files yet')).not.toBeInTheDocument();
    });
});

describe('NavItem', () => {
    it('renders label and count', () => {
        render(<NavItem icon={File} label="Test" count={5} active />);
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
