import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { completePlpSlot, createPlpBatch, failPlpSlot, setPlpLaunchStatus } from '../plpBatch';
import PlpBatchStatus from './PlpBatchStatus';

describe('PlpBatchStatus', () => {
    it('shows queued and failed slots and targets retry to the selected slot', () => {
        const onRetry = vi.fn();
        const batch = failPlpSlot(createPlpBatch('batch-1', 'project-1', 'prompt'), 14, 'Render failed at provider.');

        render(<PlpBatchStatus batch={batch} isProjectActive onRetry={onRetry} onLaunch={vi.fn()} />);

        expect(screen.getByText('0 completed')).toBeInTheDocument();
        expect(screen.getByText('14 queued')).toBeInTheDocument();
        expect(screen.getByText('1 failed')).toBeInTheDocument();
        expect(screen.getByText('Render failed at provider.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry Video 5' }));
        expect(onRetry).toHaveBeenCalledWith(14);
        expect(screen.getByRole('button', { name: /Waiting for queued variants/i })).toBeDisabled();
    });

    it('keeps launch disabled until every slot has a playable completion', () => {
        const onLaunch = vi.fn();
        let batch = createPlpBatch('batch-1', 'project-1', 'prompt');
        for (let index = 0; index < 15; index += 1) {
            batch = index === 14
                ? failPlpSlot(batch, index, 'Cancelled')
                : completePlpSlot(batch, index, {
                    id: `asset-${index}`,
                    url: `https://cdn.example/asset-${index}`,
                    prompt: 'prompt',
                });
        }

        render(<PlpBatchStatus batch={batch} isProjectActive onRetry={vi.fn()} onLaunch={onLaunch} />);

        const launch = screen.getByRole('button', { name: 'Retry failed variants before launch' });
        expect(launch).toBeDisabled();
        fireEvent.click(launch);
        expect(onLaunch).not.toHaveBeenCalled();
    });

    it('fails closed after an ambiguous provider launch error', () => {
        let batch = createPlpBatch('batch-1', 'project-1', 'prompt');
        for (let index = 0; index < 15; index += 1) {
            batch = completePlpSlot(batch, index, {
                id: `asset-${index}`,
                url: `https://cdn.example/asset-${index}`,
                prompt: 'prompt',
            });
        }
        batch = setPlpLaunchStatus(batch, 'attention_required');

        render(<PlpBatchStatus batch={batch} isProjectActive onRetry={vi.fn()} onLaunch={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Verify campaign status before retrying' })).toBeDisabled();
    });

    it('disables retry and launch outside the batch owning project', () => {
        let batch = createPlpBatch('batch-1', 'project-1', 'prompt');
        for (let index = 0; index < 14; index += 1) {
            batch = completePlpSlot(batch, index, {
                id: `asset-${index}`,
                url: `https://cdn.example/asset-${index}`,
                prompt: 'prompt',
            });
        }
        batch = failPlpSlot(batch, 14, 'Cancelled');

        render(<PlpBatchStatus batch={batch} isProjectActive={false} onRetry={vi.fn()} onLaunch={vi.fn()} />);

        expect(screen.getByText(/Switch back to this batch's project/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry Video 5' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Retry failed variants before launch' })).toBeDisabled();
    });
});
