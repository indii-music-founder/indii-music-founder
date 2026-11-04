import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ToolApprovalsPanel from './ToolApprovalsPanel';

const approvalItems = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
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
