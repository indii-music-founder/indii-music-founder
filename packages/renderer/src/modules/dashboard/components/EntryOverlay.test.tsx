import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryOverlay } from './EntryOverlay';

const mockEntryContext = vi.hoisted(() => ({
    scenario: 'new-user' as const,
    userName: '',
    memoryContext: null,
    suggestedActions: [],
    isLoading: false,
}));

vi.mock('../hooks/useEntryContext', () => ({
    useEntryContext: () => mockEntryContext,
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { conversationMode: string }) => unknown) =>
        selector({ conversationMode: 'direct' }),
}));

describe('EntryOverlay', () => {
    beforeEach(() => {
        mockEntryContext.scenario = 'new-user';
        mockEntryContext.userName = '';
    });

    it('uses a natural greeting when the profile has no display name', () => {
        render(<EntryOverlay onSubmit={vi.fn()} onDismiss={vi.fn()} />);

        expect(screen.getByRole('heading', { name: 'Welcome to indii.' })).toBeInTheDocument();
        expect(screen.queryByText('Welcome to indii, .')).not.toBeInTheDocument();
    });

    it('exposes one dismissal control and delegates durable state to its parent', () => {
        const onDismiss = vi.fn();
        render(<EntryOverlay onSubmit={vi.fn()} onDismiss={onDismiss} />);

        const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss Entry Assistant' });
        expect(dismissButtons).toHaveLength(1);

        fireEvent.click(dismissButtons[0]!);
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
