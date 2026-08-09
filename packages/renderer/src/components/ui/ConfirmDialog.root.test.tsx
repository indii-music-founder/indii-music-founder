import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog callable Root', () => {
    it('is callable immediately after its stable Root mounts and resolves cancellation', async () => {
        const user = userEvent.setup();
        render(<ConfirmDialog />);

        let response!: Promise<boolean>;
        await act(async () => {
            response = ConfirmDialog.call({ message: 'Keep the local workspace?' });
        });

        // Motion begins at opacity 0 and advances on the animation frame clock;
        // the callable contract is that the dialog is mounted and actionable.
        expect(await screen.findByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await expect(response).resolves.toBe(false);
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Confirm' })).not.toBeInTheDocument();
        });
    });
});
