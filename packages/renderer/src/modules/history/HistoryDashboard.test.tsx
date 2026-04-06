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
vi.mock('@/lib/utils', () => ({ formatSmartDate: (ts: number) => new Date(ts).toLocaleDateString(), cn: (...args: string[]) => args.filter(Boolean).join(' ') }));
vi.mock('@/core/store/slices/agent', () => ({}));

import HistoryDashboard from './HistoryDashboard';
import { FilterItem } from './components/FilterItem';

describe('HistoryDashboard', () => {
    beforeEach(() => {
        mockStore = {
            sessions: {},
            activeSessionId: null,
            setActiveSession: vi.fn(),
            deleteSession: vi.fn(),
            updateSessionTitle: vi.fn(),
            fileNodes: [],
        };
    });

    it('renders the title', () => {
        render(<HistoryDashboard />);
        expect(screen.getByText('HISTORY')).toBeInTheDocument();
        expect(screen.getByText('Unified Activity Feed')).toBeInTheDocument();
    });

    it('renders filter buttons', () => {
        render(<HistoryDashboard />);
        expect(screen.getByText('All Activity')).toBeInTheDocument();
        expect(screen.getByText('Agent Sessions')).toBeInTheDocument();
        expect(screen.getByText('Asset Creation')).toBeInTheDocument();
    });

    it('shows empty state when no history', () => {
        render(<HistoryDashboard />);
        expect(screen.getByText('No activity found')).toBeInTheDocument();
    });
});

describe('FilterItem', () => {
    it('renders label and active state', () => {
        render(<FilterItem icon={() => <span>I</span>} label="Test Filter" active />);
        expect(screen.getByText('Test Filter')).toBeInTheDocument();
    });
});
