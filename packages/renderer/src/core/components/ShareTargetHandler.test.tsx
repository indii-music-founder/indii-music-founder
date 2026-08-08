import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    deleteItem: vi.fn(),
    getItem: vi.fn(),
    setCommandBarAttachments: vi.fn(),
    setCommandBarInput: vi.fn(),
    toggleAgentWindow: vi.fn(),
}));

const sharedFile = new File(['audio'], 'idea.wav', { type: 'audio/wav' });

vi.mock('idb', () => ({
    openDB: vi.fn(async () => ({
        delete: mocks.deleteItem,
        transaction: () => ({
            objectStore: () => ({
                getAllKeys: async () => [7],
                get: mocks.getItem,
            }),
        }),
    })),
}));

vi.mock('../store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        commandBarAttachments: [],
        commandBarInput: '',
        isAgentOpen: false,
        setCommandBarAttachments: mocks.setCommandBarAttachments,
        setCommandBarInput: mocks.setCommandBarInput,
        toggleAgentWindow: mocks.toggleAgentWindow,
    }),
}));

import { ShareTargetHandler } from './ShareTargetHandler';

describe('ShareTargetHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getItem.mockResolvedValue({
            files: [sharedFile],
            title: 'New idea',
            text: 'Please review',
            url: 'https://example.com/reference',
            timestamp: Date.now(),
        });
    });

    it('moves received content into a real Conductor draft before clearing IndexedDB', async () => {
        render(
            <MemoryRouter initialEntries={['/?action=share-target']}>
                <ShareTargetHandler />
            </MemoryRouter>,
        );

        const openButton = await screen.findByRole('button', { name: 'Open in Conductor' });
        fireEvent.click(openButton);

        expect(mocks.setCommandBarAttachments).toHaveBeenCalledWith([sharedFile]);
        expect(mocks.setCommandBarInput).toHaveBeenCalledWith(expect.stringContaining('Please review'));
        expect(mocks.toggleAgentWindow).toHaveBeenCalledOnce();
        await waitFor(() => expect(mocks.deleteItem).toHaveBeenCalledWith('shared-items', 7));
    });
});
