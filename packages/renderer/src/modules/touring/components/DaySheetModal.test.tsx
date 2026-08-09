import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DaySheetModal } from './DaySheetModal';

function filterMotionProps(props: Record<string, unknown>): Record<string, unknown> {
    const { initial: _initial, animate: _animate, transition: _transition, ...domProps } = props;
    return domProps;
}

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...filterMotionProps(props)}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DaySheetModal', () => {
    it('persists the promoter email needed for advance delivery', () => {
        const onSave = vi.fn();
        const onClose = vi.fn();
        render(
            <DaySheetModal
                isOpen
                stop={{
                    id: 'stop-1',
                    date: '2026-08-20',
                    city: 'Detroit',
                    venue: 'Fox Theatre',
                    activity: 'Show',
                    notes: '',
                    contacts: [{ role: 'Promoter', name: 'Pat Promoter', phone: '313-555-0100' }],
                }}
                onClose={onClose}
                onSave={onSave}
            />
        );

        fireEvent.change(screen.getByLabelText('Promoter email'), {
            target: { value: 'promoter@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sync intelligence/i }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            contacts: [expect.objectContaining({ email: 'promoter@example.com' })],
        }));
        expect(onClose).toHaveBeenCalled();
    });
});
