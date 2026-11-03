import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PromptDialog } from './PromptDialog';

describe('PromptDialog callable Root', () => {
    it('closes only the top Call on Escape inside its input and restores the lower Call', async () => {
        const user = userEvent.setup();
        render(<PromptDialog />);

        let first!: Promise<string | null>;
        let second!: Promise<string | null>;
        await act(async () => {
            first = PromptDialog.call({ title: 'First prompt', message: 'First answer' });
            second = PromptDialog.call({ title: 'Second prompt', message: 'Second answer' });
        });

        const dialogs = screen.getAllByRole('dialog');
        expect(dialogs).toHaveLength(2);
        expect(new Set(dialogs.map(dialog => dialog.getAttribute('aria-labelledby'))).size).toBe(2);
        const inputs = screen.getAllByRole('textbox', { name: 'Response' });
        expect(inputs[1]).toHaveFocus();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
        await expect(second).resolves.toBeNull();
        expect(inputs[0]).toHaveFocus();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await expect(first).resolves.toBeNull();
    });
});
