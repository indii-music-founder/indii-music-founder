import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ApprovalQueue from './ApprovalQueue';
import type { DesktopState } from '@/services/agent/RemoteRelayService';

vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
    motion: {
        div: ({ children, initial, animate, exit, transition, ...props }: React.PropsWithChildren<Record<string, unknown>> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
        button: ({ children, whileTap, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>> & Record<string, unknown>) => (
            <button {...props}>{children}</button>
        ),
    },
}));

describe('ApprovalQueue primitives', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-15T18:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function makeApproval(overrides: Partial<NonNullable<DesktopState['pendingApproval']>> = {}): NonNullable<DesktopState['pendingApproval']> {
        return {
            id: 'req-alpha-001',
            content: 'Send distribution package to aggregator?',
            timestamp: Date.now() - 2000,
            expiresAt: Date.now() + 5000,
            ...overrides,
        };
    }

    it('disables buttons and displays expired status once expiresAt passes', () => {
        const onDecision = vi.fn(async () => undefined);
        render(<ApprovalQueue approval={makeApproval()} onDecision={onDecision} />);

        const approveBtn = screen.getByRole('button', { name: /approve/i });
        const rejectBtn = screen.getByRole('button', { name: /reject/i });
        expect(approveBtn).toBeEnabled();
        expect(rejectBtn).toBeEnabled();

        act(() => {
            vi.advanceTimersByTime(6000);
        });

        expect(approveBtn).toBeDisabled();
        expect(rejectBtn).toBeDisabled();
        expect(screen.getByText(/Authorization expired/i)).toBeInTheDocument();
        expect(onDecision).not.toHaveBeenCalled();
    });

    it('clears prior decision confirmation when approval.id rotates', async () => {
        const onDecision = vi.fn(async () => undefined);
        const first = makeApproval({ id: 'req-one' });
        const { rerender } = render(<ApprovalQueue approval={first} onDecision={onDecision} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }));
        });
        expect(onDecision).toHaveBeenCalledWith('approve', 'req-one');
        expect(screen.getByText(/Decision sent/i)).toBeInTheDocument();

        const second = makeApproval({ id: 'req-two', content: 'Approve publishing metadata?' });
        rerender(<ApprovalQueue approval={second} onDecision={onDecision} />);

        expect(screen.queryByText(/Decision sent/i)).not.toBeInTheDocument();
        expect(screen.getByText('Approve publishing metadata?')).toBeInTheDocument();
    });

    it('surfaces explicit error alert when Studio rejects decision and ignores late resolution after unmount', async () => {
        const failingDecision = vi.fn().mockRejectedValueOnce(new Error('Disconnected'));
        const { unmount, rerender } = render(<ApprovalQueue approval={makeApproval()} onDecision={failingDecision} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /reject/i }));
        });
        expect(screen.getByRole('alert')).toHaveTextContent(/Studio did not accept the decision/i);

        let resolvePending: (() => void) | undefined;
        const slowDecision = vi.fn(() => new Promise<void>((res) => { resolvePending = res; }));
        rerender(<ApprovalQueue approval={makeApproval({ id: 'req-slow' })} onDecision={slowDecision} />);

        fireEvent.click(screen.getByRole('button', { name: /approve/i }));
        unmount();

        await act(async () => {
            resolvePending?.();
        });
        expect(slowDecision).toHaveBeenCalledWith('approve', 'req-slow');
    });
});
