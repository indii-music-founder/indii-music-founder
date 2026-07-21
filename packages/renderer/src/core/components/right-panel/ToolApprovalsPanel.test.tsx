import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ToolApprovalsPanel from './ToolApprovalsPanel';

const toastMocks = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => toastMocks,
}));

const mockOnPendingApprovals = vi.fn((callback: (a: unknown[]) => void) => {
    callback([]);
    return () => {};
});
vi.mock('@/services/agent/governance/ToolApprovalService', () => ({
    toolApprovalService: {
        onPendingApprovals: (cb: (a: unknown[]) => void) => mockOnPendingApprovals(cb),
        approve: vi.fn(),
        deny: vi.fn(),
    },
}));

vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
         
        get: (_t, property: string) => ({ children, ...props }: any) => React.createElement(property === 'div' ? 'div' : property, props, children),
    }),
}));

describe('ToolApprovalsPanel — allowlist section (ISSUE-1111 residual #4)', () => {
    const mockToggleRightPanel = vi.fn();
    let allowlistGet: ReturnType<typeof vi.fn>;
    let allowlistAdd: ReturnType<typeof vi.fn>;
    let allowlistRemove: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        allowlistGet = vi.fn().mockResolvedValue({ success: true, data: { apps: [] } });
        allowlistAdd = vi.fn().mockResolvedValue({ success: true, data: { apps: ['Safari'] } });
        allowlistRemove = vi.fn().mockResolvedValue({ success: true, data: { apps: [] } });

         
        (window as any).electronAPI = {
            computer: { allowlistGet, allowlistAdd, allowlistRemove },
        };
    });

    it('renders empty state when the allowlist is empty', async () => {
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        expect(await screen.findByText(/No apps allowlisted yet/)).toBeInTheDocument();
        expect(allowlistGet).toHaveBeenCalled();
    });

    it('shows a graceful message when the desktop app is unavailable', async () => {
         
        (window as any).electronAPI = undefined;
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        expect(await screen.findByText(/Requires the indii desktop app/)).toBeInTheDocument();
    });

    it('adds an app to the allowlist and renders it', async () => {
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        await screen.findByText(/No apps allowlisted yet/);

        const input = screen.getByPlaceholderText('Safari or com.apple.Safari');
        fireEvent.change(input, { target: { value: 'Safari' } });
        fireEvent.click(screen.getByLabelText('Add app to allowlist'));

        await waitFor(() => expect(allowlistAdd).toHaveBeenCalledWith('Safari'));
        expect(await screen.findByText('Safari')).toBeInTheDocument();
        expect(toastMocks.success).toHaveBeenCalled();
    });

    it('adds an app on Enter keypress, not just button click', async () => {
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        await screen.findByText(/No apps allowlisted yet/);

        const input = screen.getByPlaceholderText('Safari or com.apple.Safari');
        fireEvent.change(input, { target: { value: 'Safari' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(allowlistAdd).toHaveBeenCalledWith('Safari'));
    });

    it('removes an app from the allowlist', async () => {
        allowlistGet.mockResolvedValue({ success: true, data: { apps: ['Safari'] } });
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);

        const removeButton = await screen.findByLabelText('Remove Safari from allowlist');
        fireEvent.click(removeButton);

        await waitFor(() => expect(allowlistRemove).toHaveBeenCalledWith('Safari'));
        expect(toastMocks.success).toHaveBeenCalled();
    });

    it('surfaces an error toast when add fails', async () => {
        allowlistAdd.mockResolvedValue({ success: false, error: 'App not permitted' });
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        await screen.findByText(/No apps allowlisted yet/);

        fireEvent.change(screen.getByPlaceholderText('Safari or com.apple.Safari'), { target: { value: 'BadApp' } });
        fireEvent.click(screen.getByLabelText('Add app to allowlist'));

        await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('App not permitted'));
    });

    it('does not call add with a blank/whitespace-only value', async () => {
        render(<ToolApprovalsPanel toggleRightPanel={mockToggleRightPanel} />);
        await screen.findByText(/No apps allowlisted yet/);

        const addButton = screen.getByLabelText('Add app to allowlist');
        expect(addButton).toBeDisabled();
    });
});
