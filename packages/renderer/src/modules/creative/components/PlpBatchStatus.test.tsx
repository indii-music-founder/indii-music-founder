import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { completePlpSlot, createPlpBatch, failPlpSlot, setPlpLaunchStatus } from '../plpBatch';
import PlpBatchStatus from './PlpBatchStatus';
import * as judgments from '@/config/typesafeJudgments';

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

    it('labels provider confidence without claiming measured fit or conversion', async () => {
        const spy = vi.spyOn(judgments, 'judgePlpVariantAdFormat').mockResolvedValue({ source: 'jev', confidence: 0.9, formatTag: 'HIGH_CONVERTING_HERO', retryRecommended: false, reason: 'Layout classification' });
        try {
            render(<PlpBatchStatus batch={createPlpBatch('provider-format', 'project-1', 'wide banner')} isProjectActive onRetry={vi.fn()} onLaunch={vi.fn()} />);
            expect((await screen.findAllByText('90% Jev confidence')).length).toBeGreaterThan(0);
            expect(screen.queryByText('Top Pick')).not.toBeInTheDocument();
            expect(screen.queryByText(/HIGH CONVERTING HERO/)).not.toBeInTheDocument();
        } finally { spy.mockRestore(); }
    });

    it('shows format heuristics without unearned quality awards or fit percentages', async () => {
        let batch = createPlpBatch('batch-1', 'project-1', 'cinematic wide album launch banner');
        batch = completePlpSlot(batch, 0, {
            id: 'asset-0',
            url: 'https://cdn.example/asset-0',
            prompt: 'cinematic wide album launch banner',
        });

        render(<PlpBatchStatus batch={batch} isProjectActive onRetry={vi.fn()} onLaunch={vi.fn()} />);

        expect(screen.queryByText('Top Pick')).not.toBeInTheDocument();

        // Format tag rendered ambiently
        const formatTag = await screen.findByTestId('jev-plp-format-tag-0');
        expect(formatTag).toBeInTheDocument();
        expect(formatTag).toHaveTextContent(/HERO LAYOUT/i);
        expect(screen.getAllByText('Format heuristic').length).toBeGreaterThan(0);
        expect(screen.queryByText(/% fit/)).not.toBeInTheDocument();
    });
});
