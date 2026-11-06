import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    approve: vi.fn(), deny: vi.fn(), canApprove: vi.fn(),
    items: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/services/agent/governance/ToolApprovalService', () => ({ toolApprovalService: {
    onPendingApprovals: (callback: (items: unknown[]) => void) => { callback(mocks.items); return vi.fn(); },
    approve: mocks.approve, deny: mocks.deny, canApproveInThisSession: mocks.canApprove,
} }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
import { WIDGET_RENDERERS } from './CustomDashboardWidgets';

describe('dashboard approval widget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.items = ['first', 'second'].map(id => ({ id, toolName: 'report_bug', description: id, status: 'pending', riskTier: 'write' }));
        mocks.canApprove.mockReturnValue(true);
    });
    it('leaves foreign-session requests visible and deniable without offering execution', () => {
        mocks.canApprove.mockReturnValue(false);
        render(WIDGET_RENDERERS.approval_gates());
        expect(screen.getByTestId('gate-approve-first')).toBeDisabled();
        expect(screen.getByTestId('gate-deny-first')).toBeEnabled();
        expect(screen.getAllByText(/Requested in another session/)).toHaveLength(2);
    });
    it('locks all cards during execution and recovers after failure', async () => {
        let finish!: (result: { success: boolean }) => void;
        mocks.approve.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        render(WIDGET_RENDERERS.approval_gates());
        fireEvent.click(screen.getByTestId('gate-approve-first'));
        expect(screen.getByTestId('gate-approve-second')).toBeDisabled();
        expect(screen.getByTestId('gate-deny-second')).toBeDisabled();
        fireEvent.click(screen.getByTestId('gate-approve-second'));
        expect(mocks.approve).toHaveBeenCalledTimes(1);
        finish({ success: false });
        await waitFor(() => expect(screen.getByTestId('gate-deny-second')).toBeEnabled());
        fireEvent.click(screen.getByTestId('gate-deny-second'));
        await waitFor(() => expect(mocks.deny).toHaveBeenCalledWith('second', expect.any(String)));
    });
});
