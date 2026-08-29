import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RightsEditorDialog } from '../RightsEditorDialog';

describe('RightsEditorDialog callable Root (H2.2 — RTL dialog pattern)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('is callable via its Root and resolves a saved record', async () => {
        const user = userEvent.setup();
        render(<RightsEditorDialog />);

        let response!: Promise<{ usageRights: string; disclosureRequired: boolean } | null>;
        await act(async () => {
            response = RightsEditorDialog.call({ assetId: 'asset_1' }) as ReturnType<typeof RightsEditorDialog.call>;
        });

        expect(await screen.findByRole('dialog', { name: /Rights/ })).toBeInTheDocument();
        expect(screen.getByTestId('rights-select')).toHaveValue('ai-generated');
        expect(screen.getByTestId('release-id')).toBeInTheDocument();

        await user.click(screen.getByTestId('rights-save'));
        await expect(response).resolves.toEqual(expect.objectContaining({ usageRights: 'ai-generated', disclosureRequired: true }));
    });

    it('blocks licensed-third-party without license notes, then saves with them', async () => {
        const user = userEvent.setup();
        render(<RightsEditorDialog />);

        let response!: Promise<unknown>;
        await act(async () => {
            response = RightsEditorDialog.call({ assetId: 'asset_1' });
        });
        await screen.findByRole('dialog', { name: /Rights/ });

        await user.selectOptions(screen.getByTestId('rights-select'), 'licensed-third-party');
        await user.click(screen.getByTestId('rights-save'));
        expect(screen.getByTestId('rights-error')).toHaveTextContent(/licensed-third-party requires licenseNotes/);

        await user.type(screen.getByTestId('license-notes'), 'via BMG');
        await user.click(screen.getByTestId('rights-save'));
        await expect(response).resolves.toEqual(expect.objectContaining({ usageRights: 'licensed-third-party', licenseNotes: 'via BMG' }));
    });

    it('cancels by ending with null', async () => {
        const user = userEvent.setup();
        render(<RightsEditorDialog />);
        let response!: Promise<unknown>;
        await act(async () => { response = RightsEditorDialog.call({ assetId: 'asset_1' }); });
        await screen.findByRole('dialog', { name: /Rights/ });
        await user.click(screen.getByText('Cancel'));
        await expect(response).resolves.toBeNull();
        await waitFor(() => expect(screen.queryByRole('dialog', { name: /Rights/ })).not.toBeInTheDocument());
    });
});
