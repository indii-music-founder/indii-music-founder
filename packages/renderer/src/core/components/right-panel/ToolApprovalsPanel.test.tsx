import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ToolApprovalsPanel from './ToolApprovalsPanel';

vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/services/agent/governance/ToolApprovalService', () => ({
    toolApprovalService: { onPendingApprovals: (callback: (items: unknown[]) => void) => { callback([]); return () => {}; }, approve: vi.fn(), deny: vi.fn() },
}));
vi.mock('motion/react', () => ({ motion: new Proxy({}, { get: (_target, property: string) => ({ children, ...props }: any) => React.createElement(property, props, children) }) }));

describe('ToolApprovalsPanel computer allowlist boundary', () => {
    const allowlistGet = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
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
});
