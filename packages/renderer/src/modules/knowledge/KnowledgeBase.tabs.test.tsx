/**
 * KnowledgeBase tab consolidation tests (ISSUE-1442 Stage 2).
 *
 * The "what the system remembers" surfaces fold into one destination:
 * Knowledge Base hosts Documents / Notes / Memory as tabs. Notes and Memory
 * keep their module ids for deep links but are no longer separate nav
 * destinations. Memory stays gated behind the dev-modules flag.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getDocuments: vi.fn(),
    devModulesEnabled: vi.fn(),
}));

vi.mock('./services/KnowledgeBaseService', () => ({
    knowledgeBaseService: { getDocuments: mocks.getDocuments },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: { call: vi.fn() },
}));

vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: mocks.devModulesEnabled },
    FEATURE_FLAG_NAMES: { DEV_MODULES: 'enable_dev_modules' },
}));

vi.mock('@/modules/notes/NotesModule', () => ({
    default: () => <div data-testid="notes-module-stub">Notes Module</div>,
}));

vi.mock('@/modules/memory/MemoryDashboard', () => ({
    default: () => <div data-testid="memory-dashboard-stub">Memory Dashboard</div>,
}));

import KnowledgeBase from './KnowledgeBase';

describe('KnowledgeBase tab consolidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/');
        mocks.getDocuments.mockResolvedValue([]);
        mocks.devModulesEnabled.mockReturnValue(false);
    });

    it('shows Documents and Notes tabs; Memory stays dev-gated off', () => {
        render(<KnowledgeBase />);

        expect(screen.getByRole('tab', { name: /documents/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /memory/i })).not.toBeInTheDocument();
    });

    it('reveals the Memory tab when dev modules are enabled', () => {
        mocks.devModulesEnabled.mockReturnValue(true);

        render(<KnowledgeBase />);

        expect(screen.getByRole('tab', { name: /memory/i })).toBeInTheDocument();
    });

    it('mounts the folded Notes surface from its tab without leaving the destination', async () => {
        render(<KnowledgeBase />);

        fireEvent.click(screen.getByRole('tab', { name: /notes/i }));

        expect(await screen.findByTestId('notes-module-stub')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /notes/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.queryByRole('tab', { name: /documents/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('mounts the folded Memory surface from its tab when gated on', async () => {
        mocks.devModulesEnabled.mockReturnValue(true);

        render(<KnowledgeBase />);

        fireEvent.click(screen.getByRole('tab', { name: /memory/i }));

        expect(await screen.findByTestId('memory-dashboard-stub')).toBeInTheDocument();
    });

    it('opens the Notes tab from a ?tab=notes deep link', () => {
        window.history.replaceState(null, '', '/knowledge?tab=notes');

        render(<KnowledgeBase />);

        expect(screen.getByRole('tab', { name: /notes/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('notes-module-stub')).toBeInTheDocument();
    });

    it('keeps the document grid on the Documents tab', async () => {
        mocks.getDocuments.mockResolvedValue([
            { id: 'doc-1', title: 'Playbook', type: 'md', rawName: 'playbook.md', content: '# x' },
        ]);

        render(<KnowledgeBase />);

        expect(await screen.findByText('Playbook')).toBeInTheDocument();
    });
});
