import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PrintSpecDialog } from './PrintSpecDialog';
import type { PrintPlan } from '@/services/print/PrintSpec';

describe('PrintSpecDialog callable Root (ISSUE-321)', () => {
    it('opens for a call, shows the pre-flight verdict, and resolves the plan', async () => {
        const user = userEvent.setup();
        render(<PrintSpecDialog />);

        let response!: Promise<PrintPlan | null>;
        await act(async () => {
            response = PrintSpecDialog.call({ srcWidth: 2048, srcHeight: 2048 });
        });

        expect(await screen.findByRole('dialog', { name: 'Print Size Check' })).toBeInTheDocument();

        // Vinyl sleeve from a 2K square: upscale needed.
        expect(screen.getByTestId('printspec-verdict')).toHaveTextContent('Upscale needed');
        expect(screen.getByTestId('printspec-summary')).toHaveTextContent('3713 × 3713 px');
        expect(screen.getByTestId('printspec-summary')).toHaveTextContent('300 DPI');

        await user.click(screen.getByTestId('printspec-use-plan'));
        const plan = await response;
        expect(plan?.presetId).toBe('vinyl_sleeve');
        expect(plan?.verdict).toBe('upscale');
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Print Size Check' })).not.toBeInTheDocument();
        });
    });

    it('renders the warn state for an unreachable print target', async () => {
        const user = userEvent.setup();
        render(<PrintSpecDialog />);

        await act(async () => {
            PrintSpecDialog.call({ srcWidth: 2048, srcHeight: 2048 });
        });
        await screen.findByRole('dialog', { name: 'Print Size Check' });

        await user.selectOptions(screen.getByTestId('printspec-preset-select'), 'poster_24x36');

        expect(screen.getByTestId('printspec-verdict')).toHaveTextContent('Target not reachable');
        const warnings = screen.getByTestId('printspec-warnings');
        expect(warnings).toHaveTextContent(`a ${4}× upscale reaches`);
        expect(warnings).toHaveTextContent('DPI floor');
    });

    it('resolves null when dismissed', async () => {
        const user = userEvent.setup();
        render(<PrintSpecDialog />);

        let response!: Promise<PrintPlan | null>;
        await act(async () => {
            response = PrintSpecDialog.call({ srcWidth: 4096, srcHeight: 4096 });
        });
        await screen.findByRole('dialog', { name: 'Print Size Check' });

        await user.click(screen.getByRole('button', { name: 'Close' }));
        await expect(response).resolves.toBeNull();
    });
});
