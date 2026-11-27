import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));

const mockStoreState: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }));

import { SwarmCollaborationFeed } from '@/modules/boardroom/components/SwarmCollaborationFeed';

const pendingHandoff = {
    id: 'h1',
    fromAgent: 'generalist',
    toAgent: 'legal',
    content: 'Draft the split agreement',
    timestamp: Date.now(),
    requiresApproval: true,
    approved: false,
};

describe('SwarmCollaborationFeed approvals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(mockStoreState, {
            a2aMessages: [pendingHandoff],
            updateA2AMessage: vi.fn(),
        });
    });

    it('exposes a modal name and dismisses the focused drawer on Escape', () => {
        const onClose = vi.fn();
        render(<SwarmCollaborationFeed isOpen onClose={onClose} />);
        const dialog = screen.getByRole('dialog', { name: 'Team Activity' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const close = screen.getByRole('button', { name: 'Close collaboration feed' });
        expect(close).toHaveFocus();
        fireEvent.keyDown(close, { key: 'Escape', code: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('records a rejection the router can act on (ISSUE-1628)', () => {
        render(<SwarmCollaborationFeed isOpen onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /request revision/i }));
        expect(mockStoreState.updateA2AMessage).toHaveBeenCalledWith('h1', { approved: false, rejected: true });
    });

    it('records an approval', () => {
        render(<SwarmCollaborationFeed isOpen onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /approve handoff/i }));
        expect(mockStoreState.updateA2AMessage).toHaveBeenCalledWith('h1', { approved: true, rejected: false });
    });

    it('shows a settled state instead of live buttons once rejected', () => {
        mockStoreState.a2aMessages = [{ ...pendingHandoff, rejected: true }];
        render(<SwarmCollaborationFeed isOpen onClose={() => {}} />);
        expect(screen.queryByRole('button', { name: /request revision/i })).toBeNull();
        expect(screen.getByText(/revision requested/i)).toBeInTheDocument();
    });
});
