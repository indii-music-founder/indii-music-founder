import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketingPanel from './MarketingPanel';

const mocks = vi.hoisted(() => ({
    executeWorkflowWithStatus: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock('@/services/agent/OrchestrationService', () => ({
    OrchestrationService: class {
        executeWorkflowWithStatus = mocks.executeWorkflowWithStatus;
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        currentProjectId: 'project-1',
        userProfile: { id: 'user-1' },
    }),
}));

vi.mock('motion/react', () => ({
    motion: {
        button: ({ children, whileHover: _whileHover, whileTap: _whileTap, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
            whileHover?: unknown;
            whileTap?: unknown;
        }) => <button {...props}>{children}</button>,
    },
}));

describe('MarketingPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not report a protocol as deployed when workflow steps failed', async () => {
        mocks.executeWorkflowWithStatus.mockResolvedValue({
            executionId: 'exec-failed',
            report: 'step failed',
            completed: false,
        });
        const closePanel = vi.fn();
        render(<MarketingPanel toggleRightPanel={closePanel} />);

        fireEvent.click(screen.getByRole('button', { name: /prepare protocol/i }));

        await waitFor(() => {
            expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('exec-failed'));
        });
        expect(mocks.success).not.toHaveBeenCalled();
        expect(closePanel).not.toHaveBeenCalled();
    });
});
