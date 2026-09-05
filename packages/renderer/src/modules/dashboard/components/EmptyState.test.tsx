import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { getUserWorkflows } from '@/modules/workflow/services/workflowPersistence';

const mocks = vi.hoisted(() => ({
    setModule: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setEntryAssistantDismissed: vi.fn(),
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

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        setModule: mocks.setModule,
        isEntryAssistantDismissed: true,
        setEntryAssistantDismissed: mocks.setEntryAssistantDismissed,
        user: { uid: 'artist-1' },
        setNodes: mocks.setNodes,
        setEdges: mocks.setEdges,
    }),
}));

vi.mock('@/modules/workflow/services/workflowPersistence', () => ({
    getUserWorkflows: vi.fn(),
}));

vi.mock('@/core/logger/Logger', () => ({
    Logger: { error: vi.fn() },
}));

vi.mock('@/components/shared/IndiiFavicon', () => ({
    IndiiFavicon: () => <div data-testid="indii-favicon" />,
}));

vi.mock('./EntryOverlay', () => ({
    EntryOverlay: () => <div>Entry Assistant</div>,
}));

vi.mock('motion/react', () => {
    const motionProxy = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const {
                    initial: _initial,
                    animate: _animate,
                    transition: _transition,
                    whileTap: _whileTap,
                    ...domProps
                } = props;
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...domProps}>{children}</Tag>;
            };
        },
    });

    return { motion: motionProxy };
});

describe('EmptyState homepage discovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserWorkflows).mockResolvedValue([]);
        mocks.onPendingApprovals.mockReturnValue(vi.fn());
        mocks.approve.mockResolvedValue({ success: true });
        mocks.deny.mockResolvedValue({ success: true });
    });

    it('promotes Mobile Remote and puts Build a Workflow in the suggestion grid', async () => {
        const onCommandSubmit = vi.fn();

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={onCommandSubmit}
                studioSlot={<div>Studio numbers</div>}
            />
        );

        expect(screen.getByText('Studio numbers')).toBeInTheDocument();
        expect(screen.queryByText('Your Workflows')).not.toBeInTheDocument();
        await waitFor(() => expect(getUserWorkflows).toHaveBeenCalledWith('artist-1'));

        const remote = screen.getByRole('button', {
            name: 'Connect Mobile Remote — open pairing and connection status',
        });
        const workflow = screen.getByRole('button', { name: /Build a Workflow/i });

        expect(remote).toBeInTheDocument();
        expect(workflow).toBeInTheDocument();

        fireEvent.click(remote);
        fireEvent.click(workflow);

        expect(onCommandSubmit).toHaveBeenNthCalledWith(1, '/connect-remote');
        expect(onCommandSubmit).toHaveBeenNthCalledWith(2, '/custom-workflow');
    });

    it('preserves the real saved-workflow listing and opens a selected workflow', async () => {
        const nodes = [{ id: 'node-1', type: 'input', position: { x: 0, y: 0 }, data: {} }];
        const edges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];
        vi.mocked(getUserWorkflows).mockResolvedValue([
            {
                id: 'workflow-1',
                name: 'Release Day',
                nodes,
                edges,
            },
        ] as Awaited<ReturnType<typeof getUserWorkflows>>);

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        expect(await screen.findByText('Your Workflows')).toBeInTheDocument();
        const savedWorkflow = screen.getByRole('button', { name: /Release Day/i });
        expect(screen.queryByRole('button', { name: /New workflow/i })).not.toBeInTheDocument();

        fireEvent.click(savedWorkflow);

        expect(mocks.setNodes).toHaveBeenCalledWith(nodes);
        expect(mocks.setEdges).toHaveBeenCalledWith(edges);
        expect(mocks.setModule).toHaveBeenCalledWith('workflow');
    });

    it('consolidates redundant tool launchers (create-video & design-cover) into Create Media with sub-actions and promotes Project Timeline', async () => {
        const onCommandSubmit = vi.fn();

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={onCommandSubmit}
            />
        );

        await waitFor(() => expect(getUserWorkflows).toHaveBeenCalledWith('artist-1'));

        // Check Create Media exists
        const createMedia = screen.getByRole('button', { name: 'Create Media' });
        expect(createMedia).toBeInTheDocument();
        expect(screen.getByText('AI cover art, social visuals & music videos')).toBeInTheDocument();

        // Clicking Create Media card directly launches /create-media
        fireEvent.click(createMedia);
        expect(onCommandSubmit).toHaveBeenCalledWith('/create-media');

        // Sub-actions: Cover Art & Music Video
        const coverArtBtn = screen.getByRole('button', { name: 'Cover Art' });
        const musicVideoBtn = screen.getByRole('button', { name: 'Music Video' });
        expect(coverArtBtn).toBeInTheDocument();
        expect(musicVideoBtn).toBeInTheDocument();

        fireEvent.click(coverArtBtn);
        expect(onCommandSubmit).toHaveBeenCalledWith('/design-cover');

        fireEvent.click(musicVideoBtn);
        expect(onCommandSubmit).toHaveBeenCalledWith('/create-video');

        // Project Timeline is promoted in suggestions
        const projectTimeline = screen.getByRole('button', { name: 'Project Timeline' });
        expect(projectTimeline).toBeInTheDocument();
        fireEvent.click(projectTimeline);
        expect(onCommandSubmit).toHaveBeenCalledWith('/timeline');
    });

    it('approves a pending gate from the operational banner', async () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-banner-1',
                    toolName: 'publish_release',
                    riskTier: 'destructive',
                    description: 'Final submission to DSP distribution pipeline',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        expect(screen.getByTestId('operational-approval-gate-banner')).toBeInTheDocument();
        expect(screen.getByText('1 PENDING')).toBeInTheDocument();
        expect(screen.getByText('Final submission to DSP distribution pipeline')).toBeInTheDocument();

        const approveBtn = screen.getByTestId('banner-approve-btn');
        fireEvent.click(approveBtn);

        await waitFor(() => {
            expect(mocks.approve).toHaveBeenCalledWith('gate-banner-1');
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate approved & executed');
    });

    it('denies a pending gate from the operational banner', async () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                {
                    id: 'gate-banner-2',
                    toolName: 'publish_release',
                    riskTier: 'destructive',
                    description: 'Final submission to DSP distribution pipeline',
                    createdAt: Date.now(),
                },
            ]);
            return vi.fn();
        });

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        const denyBtn = screen.getByTestId('banner-deny-btn');
        fireEvent.click(denyBtn);

        await waitFor(() => {
            expect(mocks.deny).toHaveBeenCalledWith('gate-banner-2', 'User denied from dashboard quick-action gate');
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate denied');
    });

    it('handles multiple (3+) pending gates and executes batch approve all', async () => {
        const multipleGates = [
            { id: 'gate-1', toolName: 'dsp_submission', riskTier: 'destructive', description: 'DSP submission', createdAt: Date.now() },
            { id: 'gate-2', toolName: 'budget_spend', riskTier: 'write', description: 'Meta ad spend', createdAt: Date.now() },
            { id: 'gate-3', toolName: 'social_publish', riskTier: 'write', description: 'TikTok rollout post', createdAt: Date.now() },
        ];

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback(multipleGates);
            return vi.fn();
        });

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        expect(screen.getByTestId('operational-approval-gate-banner')).toBeInTheDocument();
        expect(screen.getByText('3 PENDING')).toBeInTheDocument();
        expect(screen.getByTestId('gate-card-gate-1')).toBeInTheDocument();
        expect(screen.getByTestId('gate-card-gate-2')).toBeInTheDocument();
        expect(screen.getByTestId('gate-card-gate-3')).toBeInTheDocument();

        // Batch Approve All
        const approveAllBtn = screen.getByTestId('banner-approve-all-btn');
        expect(approveAllBtn).toBeInTheDocument();
        fireEvent.click(approveAllBtn);

        await waitFor(() => {
            expect(mocks.approve).toHaveBeenCalledWith('gate-1');
            expect(mocks.approve).toHaveBeenCalledWith('gate-2');
            expect(mocks.approve).toHaveBeenCalledWith('gate-3');
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Approved and executed 3 gates');
    });

    it('displays error toast when tool approval fails', async () => {
        mocks.approve.mockResolvedValueOnce({ success: false, error: 'Insufficient budget balance' });

        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([
                { id: 'gate-fail', toolName: 'ad_spend', riskTier: 'destructive', description: 'Campaign spend', createdAt: Date.now() },
            ]);
            return vi.fn();
        });

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        const approveBtn = screen.getByTestId('banner-approve-btn');
        fireEvent.click(approveBtn);

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Insufficient budget balance');
        });
    });

    it('does not render the approval gate banner when there are no pending approvals', async () => {
        mocks.onPendingApprovals.mockImplementation((callback) => {
            callback([]);
            return vi.fn();
        });

        render(
            <EmptyState
                onCommandClick={vi.fn()}
                onCommandSubmit={vi.fn()}
            />
        );

        await waitFor(() => expect(getUserWorkflows).toHaveBeenCalledWith('artist-1'));

        expect(screen.queryByTestId('operational-approval-gate-banner')).not.toBeInTheDocument();
    });
});
