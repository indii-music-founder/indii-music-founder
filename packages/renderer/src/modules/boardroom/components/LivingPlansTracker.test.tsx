import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LivingPlan } from '@/services/agent/LivingPlanService';
import { LivingPlansTracker } from '@/modules/boardroom/components/LivingPlansTracker';

const mocks = vi.hoisted(() => ({
    currentProjectId: 'proj-1' as string | null,
    subscribePlansForProject: vi.fn(),
    getPlansForProject: vi.fn(),
    approve: vi.fn(),
    cancel: vi.fn(),
    get: vi.fn(),
    resumeActivePlan: vi.fn(),
    confirmCall: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { currentProjectId: string | null }) => unknown) =>
        selector({ currentProjectId: mocks.currentProjectId }),
}));
vi.mock('@/services/agent/LivingPlanService', () => ({
    livingPlanService: {
        subscribePlansForProject: mocks.subscribePlansForProject,
        getPlansForProject: mocks.getPlansForProject,
        approve: mocks.approve,
        cancel: mocks.cancel,
        get: mocks.get,
    },
}));
vi.mock('@/services/agent/AgentService', () => ({
    agentService: {
        resumeActivePlan: mocks.resumeActivePlan,
    },
}));
vi.mock('@/core/components/chat/PlanCard', () => ({
    PlanCard: ({
        plan,
        onApprove,
        onCancel,
        isLoading,
    }: {
        plan: LivingPlan;
        onApprove: () => void;
        onCancel: () => void;
        isLoading?: boolean;
    }) => (
        <div data-testid={`plan-card-${plan.id}`} data-loading={isLoading ? 'true' : 'false'}>
            <span>{plan.draft.summary}</span>
            <button type="button" onClick={onApprove} disabled={isLoading}>
                Approve {plan.id}
            </button>
            <button type="button" onClick={onCancel} disabled={isLoading}>
                Cancel {plan.id}
            </button>
        </div>
    ),
}));
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: {
        call: mocks.confirmCall,
    },
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mocks.toastSuccess,
        error: mocks.toastError,
        info: mocks.toastInfo,
    }),
}));
vi.mock('@/utils/timestamps', () => ({ toMillisSafe: () => 0 }));

const samplePlan: LivingPlan = {
    id: 'plan-1',
    projectId: 'proj-1',
    userId: 'user-1',
    goal: 'Release promo rollout',
    draft: {
        shape: 'workflow',
        summary: 'Release Rollout Strategy',
        autoApprove: false,
    },
    history: [],
    status: 'drafting',
    createdAt: { toMillis: () => 1000 } as never,
    updatedAt: { toMillis: () => 1000 } as never,
};

describe('LivingPlansTracker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentProjectId = 'proj-1';
        mocks.getPlansForProject.mockResolvedValue([]);
        mocks.subscribePlansForProject.mockImplementation((_projectId, onPlans) => {
            onPlans([]);
            return vi.fn();
        });
        mocks.approve.mockResolvedValue(undefined);
        mocks.cancel.mockResolvedValue(undefined);
        mocks.get.mockResolvedValue(samplePlan);
        mocks.resumeActivePlan.mockResolvedValue(undefined);
        mocks.confirmCall.mockResolvedValue(false);
    });

    it('exposes the drawer as a modal and dismisses it on Escape', async () => {
        mocks.currentProjectId = null;
        const onClose = vi.fn();
        render(<LivingPlansTracker isOpen onClose={onClose} />);
        await screen.findByText('No living plans found.');
        expect(screen.getByRole('dialog', { name: 'Living Plans' })).toHaveAttribute('aria-modal', 'true');
        const close = screen.getByRole('button', { name: 'Close living plans' });
        expect(close).toHaveFocus();
        fireEvent.keyDown(close, { key: 'Escape', code: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('subscribes with a bounded limit of 20 and renders one empty-state hint (ISSUE-1639)', async () => {
        render(<LivingPlansTracker isOpen onClose={vi.fn()} />);

        await waitFor(() => {
            expect(mocks.subscribePlansForProject).toHaveBeenCalledWith(
                'proj-1',
                expect.any(Function),
                expect.any(Function),
                20
            );
        });
        expect(mocks.getPlansForProject).not.toHaveBeenCalled();
        expect(screen.getAllByText(/propose a strategy or plan for your project/i)).toHaveLength(1);
    });

    it('prevents double-clicking Approve from invoking resumeActivePlan twice (ISSUE-1639)', async () => {
        let resolveApprove!: () => void;
        mocks.approve.mockImplementationOnce(() => new Promise<void>(resolve => { resolveApprove = resolve; }));
        mocks.subscribePlansForProject.mockImplementation((_projectId, onPlans) => {
            onPlans([samplePlan]);
            return vi.fn();
        });

        render(<LivingPlansTracker isOpen onClose={vi.fn()} />);

        const approveBtn = await screen.findByRole('button', { name: 'Approve plan-1' });
        fireEvent.click(approveBtn);
        fireEvent.click(approveBtn);

        expect(mocks.approve).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('plan-card-plan-1')).toHaveAttribute('data-loading', 'true');

        resolveApprove();
        await waitFor(() => expect(mocks.resumeActivePlan).toHaveBeenCalledTimes(1));
    });

    it('requires ConfirmDialog confirmation before cancelling a living plan (ISSUE-1639)', async () => {
        mocks.subscribePlansForProject.mockImplementation((_projectId, onPlans) => {
            onPlans([samplePlan]);
            return vi.fn();
        });

        render(<LivingPlansTracker isOpen onClose={vi.fn()} />);

        const cancelBtn = await screen.findByRole('button', { name: 'Cancel plan-1' });
        mocks.confirmCall.mockResolvedValueOnce(false);
        fireEvent.click(cancelBtn);

        await waitFor(() => expect(mocks.confirmCall).toHaveBeenCalledTimes(1));
        expect(mocks.cancel).not.toHaveBeenCalled();

        mocks.confirmCall.mockResolvedValueOnce(true);
        fireEvent.click(cancelBtn);

        await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('proj-1', 'plan-1'));
    });
});
