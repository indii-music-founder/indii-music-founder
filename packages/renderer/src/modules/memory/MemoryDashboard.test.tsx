import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const toastError = vi.fn();

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
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: toastError,
        info: vi.fn(),
    }),
}));
vi.mock('@/services/memory/AlwaysOnMemoryService', () => ({
    AlwaysOnMemoryService: {
        getMemories: vi.fn(() => []),
        getInsights: vi.fn(() => []),
        queryMemory: vi.fn(),
        ingest: vi.fn(),
        consolidate: vi.fn(),
        deleteMemory: vi.fn(),
    },
}));
vi.mock('@/lib/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }));
vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));
vi.mock('@/types/AlwaysOnMemory', () => ({}));
vi.mock('@/core/components/ModuleErrorBoundary', () => ({
    ModuleErrorBoundary: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// The Memory module is 817 lines — we test the root renders correctly
// Sub-components are already well-structured inline functions that are now ready for extraction
import MemoryDashboard from './MemoryDashboard';

describe('MemoryDashboard', () => {
    beforeEach(() => {
        toastError.mockClear();
        mockStore = {
            user: { uid: 'user-1' },
            userProfile: { uid: 'user-1' },
            alwaysOnMemories: [],
            alwaysOnInsights: [],
            activeDirectives: [],
            memoryInboxItems: [],
            alwaysOnEngineStatus: { isRunning: true, totalMemories: 0, totalInsights: 0, unconsolidatedCount: 0 },
            memorySearchQuery: '',
            memoryFilterCategory: 'all',
            memoryFilterTier: 'all',
            selectedMemoryId: null,
            setMemorySearchQuery: vi.fn(),
            setMemoryFilterCategory: vi.fn(),
            setMemoryFilterTier: vi.fn(),
            setSelectedMemoryId: vi.fn(),
            loadAlwaysOnMemories: vi.fn(),
            loadAlwaysOnInsights: vi.fn(),
            loadDirectives: vi.fn(),
            loadMemoryInbox: vi.fn(),
            updateMemoryInboxItemStatus: vi.fn(),
            refreshAlwaysOnEngineStatus: vi.fn(),
            ingestMemoryText: vi.fn(),
            triggerMemoryConsolidation: vi.fn(),
            deleteAlwaysOnMemory: vi.fn(),
            queryAlwaysOnMemory: vi.fn(),
            startMemoryEngine: vi.fn(),
        };
    });

    it('renders the module title', () => {
        render(<MemoryDashboard />);
        expect(screen.getByText('Memory Agent')).toBeInTheDocument();
    });

    it('renders the stat badges area', () => {
        render(<MemoryDashboard />);
        expect(screen.getByText('Memories')).toBeInTheDocument();
    });

    it('renders tab navigation', () => {
        render(<MemoryDashboard />);
        expect(screen.getByText('📋 Feed')).toBeInTheDocument();
        expect(screen.getByText('🔍 Query')).toBeInTheDocument();
        expect(screen.getByText('📥 Ingest')).toBeInTheDocument();
    });

    it('shows a toast when ingest fails instead of leaving the spinner hanging', async () => {
        mockStore = {
            ...mockStore,
            ingestMemoryText: vi.fn().mockRejectedValue(new Error('ingest failed')),
        };

        render(<MemoryDashboard />);

        fireEvent.click(screen.getByText('📥 Ingest'));
        fireEvent.change(screen.getByPlaceholderText('Paste text, notes, articles, or anything you want to remember...'), {
            target: { value: 'Remember this' },
        });
        fireEvent.click(screen.getByText('Ingest Memory'));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith('ingest failed');
        });
    });
});
