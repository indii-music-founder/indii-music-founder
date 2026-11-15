import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MobileMileageModal from './MobileMileageModal';

const mocks = vi.hoisted(() => ({
    dispatchTask: vi.fn(),
    addExpense: vi.fn(),
    addNote: vi.fn(),
    toastSuccess: vi.fn(),
    toastInfo: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } } }));
vi.mock('@/core/store', () => ({
    useStore: { getState: () => ({ addNote: mocks.addNote }) },
}));
vi.mock('@/services/finance/FinanceService', () => ({
    FinanceService: class {
        addExpense = mocks.addExpense;
    },
}));
vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        dispatchTask: (...args: unknown[]) => mocks.dispatchTask(...args),
    },
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mocks.toastSuccess,
        info: mocks.toastInfo,
        error: mocks.toastError,
    }),
}));
vi.mock('../haptics', () => ({
    triggerHaptic: vi.fn(),
}));
vi.mock('./mileageRate', () => ({
    businessMileageRate: () => 0.7,
}));
vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
    motion: {
        div: ({ children, initial, animate, exit, transition, ...props }: React.PropsWithChildren<Record<string, unknown>> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
    },
}));

describe('MobileMileageModal primitives', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.addExpense.mockResolvedValue('exp-1');
    });

    it('exposes dialog accessibility attributes and closes on Escape key', () => {
        const onClose = vi.fn();
        render(<MobileMileageModal isOpen={true} onClose={onClose} isPaired={true} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('surfaces an honest sync-pending message when paired Studio dispatch fails', async () => {
        mocks.dispatchTask.mockRejectedValueOnce(new Error('Relay offline'));
        const onClose = vi.fn();
        render(<MobileMileageModal isOpen={true} onClose={onClose} isPaired={true} />);

        fireEvent.change(screen.getByPlaceholderText(/Guitar Center/i), { target: { value: 'Venue Load-In' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. 14.2'), { target: { value: '12' } });
        fireEvent.click(screen.getByRole('button', { name: /Log Mileage for Review/i }));

        await waitFor(() => expect(mocks.toastInfo).toHaveBeenCalledWith(expect.stringContaining('Studio sync pending')));
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
        expect(mocks.addNote).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
