import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DropCampaignWizard } from './DropCampaignWizard';

const mocks = vi.hoisted(() => ({ createDraft: vi.fn() }));

vi.mock('@/services/commerce/LimitedDropService', () => ({
    limitedDropService: { createDraft: mocks.createDraft },
}));

const products = [{
    id: 'shirt-1',
    userId: 'artist-123',
    title: 'Night Shift Shirt',
    image: '',
    price: '$30',
    category: 'standard' as const,
}];

async function advanceToAudience() {
    fireEvent.click(screen.getByRole('checkbox', { name: /Night Shift Shirt/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Drop name/i), { target: { value: 'Night Shift' } });
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText(/Drop Date/i), { target: { value: future } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
}

describe('DropCampaignWizard', () => {
    beforeEach(() => {
        mocks.createDraft.mockReset().mockResolvedValue({
            dropId: 'drop-123',
            status: 'draft',
            notificationStatus: 'setup_required',
        });
    });

    it('persists a draft and never claims the drop is live or fans were notified', async () => {
        render(<DropCampaignWizard isOpen onClose={vi.fn()} products={products} />);
        await advanceToAudience();
        fireEvent.click(screen.getByRole('button', { name: /Save Drop Draft/i }));

        expect(await screen.findByText(/Drop Draft Saved/i)).toBeInTheDocument();
        expect(screen.getByText(/It is not live/i)).toBeInTheDocument();
        expect(screen.getByText(/Draft ID: drop-123/i)).toBeInTheDocument();
        expect(screen.queryByText(/fans will be notified/i)).not.toBeInTheDocument();
        expect(mocks.createDraft).toHaveBeenCalledWith(expect.objectContaining({
            selectedProductIds: ['shirt-1'],
            dropName: 'Night Shift',
        }));
    });

    it('shows persistence failure and does not render a success state', async () => {
        mocks.createDraft.mockRejectedValueOnce(new Error('permission-denied'));
        render(<DropCampaignWizard isOpen onClose={vi.fn()} products={products} />);
        await advanceToAudience();
        fireEvent.click(screen.getByRole('button', { name: /Save Drop Draft/i }));

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permission-denied/i));
        expect(screen.queryByText(/Drop Draft Saved/i)).not.toBeInTheDocument();
    });
});
