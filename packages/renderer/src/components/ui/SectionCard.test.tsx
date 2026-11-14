import { useState, type FormEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionCard } from './SectionCard';

describe('SectionCard', () => {
    it('returns focus to the disclosure when its caller closes a focused panel', () => {
        const card = (isOpen: boolean) => (
            <SectionCard title="Advanced metadata" isOpen={isOpen} onToggle={() => {}}>
                <input aria-label="Catalog number" />
            </SectionCard>
        );
        const { rerender } = render(card(true));
        screen.getByRole('textbox', { name: 'Catalog number' }).focus();

        rerender(card(false));

        expect(screen.getByRole('button', { name: 'Advanced metadata' })).toHaveFocus();
        expect(screen.queryByRole('textbox', { name: 'Catalog number' })).toBeNull();
    });

    it('toggles its labeled region without submitting an enclosing form', () => {
        const submit = vi.fn((event: FormEvent) => event.preventDefault());
        function FormDisclosure() {
            const [open, setOpen] = useState(false);
            return (
                <form onSubmit={submit}>
                    <SectionCard title="Advanced metadata" isOpen={open} onToggle={() => setOpen(value => !value)}>
                        <input aria-label="Catalog number" />
                    </SectionCard>
                </form>
            );
        }

        render(<FormDisclosure />);
        const toggle = screen.getByRole('button', { name: 'Advanced metadata' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(submit).not.toHaveBeenCalled();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const region = screen.getByRole('region', { name: 'Advanced metadata' });
        expect(toggle).toHaveAttribute('aria-controls', region.id);
        expect(screen.getByRole('textbox', { name: 'Catalog number' })).toBeInTheDocument();
    });
});
