import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ToolApprovalsPanel from './ToolApprovalsPanel';
import { toolApprovalService } from '@/services/agent/governance/ToolApprovalService';

const approvalItems = vi.hoisted(() => ({ current: [] as unknown[], warning: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: approvalItems.success, error: approvalItems.error, warning: approvalItems.warning }) }));
vi.mock('@/services/agent/governance/ToolApprovalService', () => ({
    toolApprovalService: { onUnresolvedApprovals: (callback: (items: unknown[]) => void) => { callback(approvalItems.current); return () => {}; }, approve: vi.fn(), deny: vi.fn(), canApproveInThisSession: vi.fn(() => true) },
}));
vi.mock('motion/react', () => ({ motion: new Proxy({}, { get: (_target, property: string) => ({ children, ...props }: any) => React.createElement(property, props, children) }) }));

describe('ToolApprovalsPanel computer allowlist boundary', () => {
    const allowlistGet = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        approvalItems.current = [];
        allowlistGet.mockResolvedValue({ success: true, data: { apps: [] } });
        (window as any).electronAPI = { computer: { allowlistGet } };
    });

    it('serializes actions across cards and recovers after an approval rejection', async () => {
        approvalItems.current = ['first', 'second'].map(id => ({
            id, agentId: 'generalist', toolName: 'send_email', args: {},
            riskTier: 'write', description: id, status: 'pending', createdAt: new Date(),
        }));
        let rejectDispatch!: (reason: Error) => void;
        vi.mocked(toolApprovalService.approve).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDispatch = reject; }));
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        await screen.findByText(/No apps allowlisted yet/);
        const approves = () => screen.getAllByRole('button', { name: /^approve$/i });
        const denies = () => screen.getAllByRole('button', { name: /^deny$/i });
        fireEvent.click(approves()[0]!);
        expect(approves()[1]).toBeDisabled();
        expect(denies()[1]).toBeDisabled();
        fireEvent.click(approves()[1]!);
        fireEvent.click(denies()[1]!);
        expect(toolApprovalService.approve).toHaveBeenCalledTimes(1);
        expect(toolApprovalService.deny).not.toHaveBeenCalled();
        rejectDispatch(new Error('Dispatch unavailable'));
        await waitFor(() => expect(denies()[1]).toBeEnabled());
        fireEvent.click(denies()[1]!);
        await waitFor(() => expect(toolApprovalService.deny).toHaveBeenCalledWith('second', 'Denied by user'));
    });

    it('warns separately when a successful action receipt was not recorded', async () => {
        approvalItems.current = [{ id: 'first', agentId: 'generalist', toolName: 'report_bug', args: {}, riskTier: 'write', description: 'Report', status: 'pending', createdAt: new Date() }];
        vi.mocked(toolApprovalService.approve).mockResolvedValueOnce({ success: true, data: { bugId: 'saved-bug' }, metadata: { approvalPersistence: { status: 'unconfirmed', approvalId: 'first' } } });
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
        await waitFor(() => expect(approvalItems.warning).toHaveBeenCalledWith(expect.stringMatching(/tool reported success.*do not retry automatically/i)));
        expect(approvalItems.success).not.toHaveBeenCalled();
        expect(approvalItems.error).not.toHaveBeenCalled();
        expect(toolApprovalService.approve).toHaveBeenCalledTimes(1);
    });

    it('shows the fail-closed empty policy as read-only', async () => {
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        expect(await screen.findByText(/No apps allowlisted yet/)).toBeInTheDocument();
        expect(screen.getByText(/read-only in the renderer/)).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('renders existing policy without renderer mutation controls', async () => {
        allowlistGet.mockResolvedValue({ success: true, data: { apps: ['Safari'] } });
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        expect(await screen.findByText('Safari')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /remove safari/i })).not.toBeInTheDocument();
    });

    it('shows a desktop-only message when IPC is unavailable', async () => {
        (window as any).electronAPI = undefined;
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        expect(await screen.findByText(/Requires the indii desktop app/)).toBeInTheDocument();
    });

    it.each([
        ['approved', /dispatch was not confirmed/i],
        ['claimed', /may have run/i],
    ])('keeps a %s action visible with its distinct recovery message', async (status, message) => {
        approvalItems.current = [{
            id: 'approval-1', agentId: 'generalist', toolName: 'send_email', args: { subject: 'Release' },
            riskTier: 'write', description: 'Send an email', status, createdAt: new Date(),
        }];
        render(<ToolApprovalsPanel toggleRightPanel={vi.fn()} />);
        expect(screen.getByRole('status')).toHaveTextContent(message);
        expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument();
        expect(await screen.findByText(/No apps allowlisted yet/)).toBeInTheDocument();
    });
});
