import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarketingToolbar } from './MarketingToolbar';

describe('MarketingToolbar', () => {
    it('reports campaign search input instead of presenting an inert field', async () => {
        const onSearchChange = vi.fn();
        const user = userEvent.setup();
        render(<MarketingToolbar searchValue="" onSearchChange={onSearchChange} />);

        await user.type(screen.getByRole('textbox', { name: 'Search campaigns' }), 'tour');

        expect(onSearchChange).toHaveBeenCalled();
        expect(onSearchChange).toHaveBeenLastCalledWith('r');
    });
});
