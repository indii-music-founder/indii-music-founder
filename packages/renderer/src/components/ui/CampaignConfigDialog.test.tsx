import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignConfigDialog } from './CampaignConfigDialog';

describe('CampaignConfigDialog', () => {
    it('returns the edited config when launched', async () => {
        render(<CampaignConfigDialog />);
        const promise = CampaignConfigDialog.call({ variantCount: 12, defaultBody: 'my song promo' });

        const headline = await screen.findByLabelText(/Ad headline/i);
        fireEvent.change(headline, { target: { value: 'New single out now' } });
        fireEvent.change(screen.getByLabelText(/Daily budget/i), { target: { value: '5' } });
        fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: '10' } });

        fireEvent.click(screen.getByRole('button', { name: /Launch campaign/i }));

        const result = await promise;
        expect(result).toEqual({
            dailyBudget: 5,
            totalDays: 10,
            targetAgeMin: 18,
            targetAgeMax: 35,
            targetInterests: ['music', 'creativity', 'art'],
            headline: 'New single out now',
            body: 'my song promo',
        });
    });

    it('disables launch until required copy is present and shows live total', async () => {
        render(<CampaignConfigDialog />);
        const promise = CampaignConfigDialog.call({ variantCount: 15 });

        const launchBtn = await screen.findByRole('button', { name: /Launch campaign/i });
        // Default headline is empty → launch must be disabled (no accidental spend)
        expect(launchBtn).toBeDisabled();
        // Default $10/day × 28 days shown in the launch button
        expect(launchBtn).toHaveTextContent('$280.00');

        fireEvent.change(screen.getByLabelText(/Ad headline/i), { target: { value: 'Hear it first' } });
        fireEvent.change(screen.getByLabelText(/Ad body/i), { target: { value: 'Stream now' } });
        expect(launchBtn).toBeEnabled();

        fireEvent.click(screen.getByRole('button', { name: /keep the variants/i }));
        await expect(promise).resolves.toBeNull();
    });

    it('returns null when cancelled', async () => {
        render(<CampaignConfigDialog />);
        const promise = CampaignConfigDialog.call({ variantCount: 3 });
        fireEvent.click(await screen.findByRole('button', { name: /keep the variants/i }));
        await waitFor(async () => expect(await promise).toBeNull());
    });
});
