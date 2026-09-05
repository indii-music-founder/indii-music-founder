import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationalApprovalGateBanner } from './OperationalApprovalGateBanner';

const mocks = vi.hoisted(() => ({
    onPendingApprovals: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@/services/agent/governance/ToolApprovalService', () => ({
    toolApprovalService: {
        onPendingApprovals: mocks.onPendingApprovals,
        approve: mocks.approve,
        deny: mocks.deny,
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mocks.toastSuccess,
        error: mocks.toastError,
        info: vi.fn(),
        warning: vi.fn(),
    }),
}));

vi.mock('@/core/logger/Logger', () => ({
    Logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('motion/react', () => {
    const motionProxy = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const {
                    initial: _initial,
                    animate: _animate,
                    transition: _transition,
                    ...domProps
                } = props;
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...domProps}>{children}</Tag>;
            };
        },
    });

    return { motion: motionProxy };
});

describe('OperationalApprovalGateBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.approve.mockResolvedValue({ success: true });
        mocks.deny.mockResolvedValue(undefined);
    });

    it('renders null when there are no pending approvals', () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([]);
            return vi.fn();
        });

        const { container } = render(<OperationalApprovalGateBanner />);
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('operational-approval-gate-banner')).not.toBeInTheDocument();
    });

    it('renders a single pending gate with risk tier and description', () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-single-1',
                    toolName: 'publish_release',
                    riskTier: 'destructive',
                    description: 'Final submission to DSP distribution pipeline',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        expect(screen.getByTestId('operational-approval-gate-banner')).toBeInTheDocument();
        expect(screen.getByText('Quick-Action Approval Gate')).toBeInTheDocument();
        expect(screen.getByText('1 PENDING')).toBeInTheDocument();
        expect(screen.getByText('Autonomous action paused for authorization')).toBeInTheDocument();
        expect(screen.getByText('publish_release')).toBeInTheDocument();
        expect(screen.getByText('destructive')).toBeInTheDocument();
        expect(screen.getByText('Final submission to DSP distribution pipeline')).toBeInTheDocument();
        expect(screen.queryByTestId('banner-approve-all-btn')).not.toBeInTheDocument();
    });

    it('approves a single gate and displays success toast', async () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-approve-1',
                    toolName: 'launch_marketing_campaign',
                    riskTier: 'write',
                    description: 'Meta and TikTok ad spend',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const approveBtn = screen.getByTestId('banner-approve-btn');
        fireEvent.click(approveBtn);

        await waitFor(() => {
            expect(mocks.approve).toHaveBeenCalledWith('gate-approve-1');
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate approved & executed');
    });

    it('denies a single gate and displays success toast', async () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-deny-1',
                    toolName: 'delete_contract',
                    riskTier: 'destructive',
                    description: 'Purge draft contract',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const denyBtn = screen.getByTestId('banner-deny-btn');
        fireEvent.click(denyBtn);

        await waitFor(() => {
            expect(mocks.deny).toHaveBeenCalledWith('gate-deny-1', 'User denied from dashboard quick-action gate');
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate denied');
    });

    it('handles approval execution failure returned by toolApprovalService', async () => {
        mocks.approve.mockResolvedValueOnce({ success: false, error: 'Payment method declined' });

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-fail-1',
                    toolName: 'ad_spend',
                    riskTier: 'destructive',
                    description: 'Boost campaign',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const approveBtn = screen.getByTestId('banner-approve-btn');
        fireEvent.click(approveBtn);

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Payment method declined');
        });
    });

    it('handles thrown exception during approval execution', async () => {
        mocks.approve.mockRejectedValueOnce(new Error('Network disconnected'));

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-err-1',
                    toolName: 'sync_dsp',
                    riskTier: 'write',
                    description: 'Sync with DSP catalog',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const approveBtn = screen.getByTestId('banner-approve-btn');
        fireEvent.click(approveBtn);

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Failed to execute gate approval');
        });
    });

    it('handles thrown exception during denial', async () => {
        mocks.deny.mockRejectedValueOnce(new Error('Permission denied'));

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-err-2',
                    toolName: 'export_stems',
                    riskTier: 'read',
                    description: 'Download full stems package',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const denyBtn = screen.getByTestId('banner-deny-btn');
        fireEvent.click(denyBtn);

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Failed to deny gate');
        });
    });

    it('renders multiple gates with risk tiers and handles batch Approve All', async () => {
        const gates = [
            { id: 'gate-batch-1', toolName: 'publish_dsp', riskTier: 'destructive', description: 'DSP publish', createdAt: Date.now() },
            { id: 'gate-batch-2', toolName: 'meta_spend', riskTier: 'write', description: 'Meta ad spend', createdAt: Date.now() },
            { id: 'gate-batch-3', toolName: 'read_metrics', riskTier: 'read', description: 'Audience export', createdAt: Date.now() },
        ];

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback(gates);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        expect(screen.getByText('3 PENDING')).toBeInTheDocument();
        expect(screen.getByText('3 autonomous agent actions require confirmation')).toBeInTheDocument();

        // Cards rendered for all 3
        expect(screen.getByTestId('gate-card-gate-batch-1')).toBeInTheDocument();
        expect(screen.getByTestId('gate-card-gate-batch-2')).toBeInTheDocument();
        expect(screen.getByTestId('gate-card-gate-batch-3')).toBeInTheDocument();

        // Risk tiers rendered
        expect(screen.getByText('destructive')).toBeInTheDocument();
        expect(screen.getByText('write')).toBeInTheDocument();
        expect(screen.getByText('read')).toBeInTheDocument();

        // Batch Approve All button
        const approveAllBtn = screen.getByTestId('banner-approve-all-btn');
        expect(approveAllBtn).toBeInTheDocument();
        expect(approveAllBtn).toHaveTextContent('Approve All (3)');

        fireEvent.click(approveAllBtn);

        await waitFor(() => {
            expect(mocks.approve).toHaveBeenCalledWith('gate-batch-1');
            expect(mocks.approve).toHaveBeenCalledWith('gate-batch-2');
            expect(mocks.approve).toHaveBeenCalledWith('gate-batch-3');
        });

        expect(mocks.toastSuccess).toHaveBeenCalledWith('Approved and executed 3 gates');
    });

    it('reports partial errors when Approve All encounters failures', async () => {
        mocks.approve
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: false, error: 'Gate quota exceeded' });

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                { id: 'gate-p1', toolName: 'tool_1', riskTier: 'write', description: 'Gate 1', createdAt: Date.now() },
                { id: 'gate-p2', toolName: 'tool_2', riskTier: 'destructive', description: 'Gate 2', createdAt: Date.now() },
            ]);
            return vi.fn();
        });

        render(<OperationalApprovalGateBanner />);

        const approveAllBtn = screen.getByTestId('banner-approve-all-btn');
        fireEvent.click(approveAllBtn);

        await waitFor(() => {
            expect(mocks.toastSuccess).toHaveBeenCalledWith('Approved and executed 1 gate');
            expect(mocks.toastError).toHaveBeenCalledWith('1 gate approval encountered issues');
        });
    });

    it('cleans up subscription on unmount', () => {
        const unsubscribeMock = vi.fn();
        mocks.onPendingApprovals.mockReturnValue(unsubscribeMock);

        const { unmount } = render(<OperationalApprovalGateBanner />);
        unmount();

        expect(unsubscribeMock).toHaveBeenCalled();
    });
});
