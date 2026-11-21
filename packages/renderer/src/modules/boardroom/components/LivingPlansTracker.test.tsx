import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LivingPlansTracker } from './LivingPlansTracker';

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { currentProjectId: null }) => unknown) =>
        selector({ currentProjectId: null }),
}));
vi.mock('@/services/agent/LivingPlanService', () => ({ livingPlanService: {} }));
vi.mock('@/services/agent/AgentService', () => ({ agentService: {} }));
vi.mock('@/core/components/chat/PlanCard', () => ({ PlanCard: () => null }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({}) }));
vi.mock('@/utils/timestamps', () => ({ toMillisSafe: () => 0 }));

describe('LivingPlansTracker', () => {
    it('exposes the drawer as a modal and dismisses it on Escape', async () => {
        const onClose = vi.fn();
        render(<LivingPlansTracker isOpen onClose={onClose} />);
        await screen.findByText('No living plans found.');
        expect(screen.getByRole('dialog', { name: 'Living Plans' })).toHaveAttribute('aria-modal', 'true');
        const close = screen.getByRole('button', { name: 'Close living plans' });
        expect(close).toHaveFocus();
        fireEvent.keyDown(close, { key: 'Escape', code: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
