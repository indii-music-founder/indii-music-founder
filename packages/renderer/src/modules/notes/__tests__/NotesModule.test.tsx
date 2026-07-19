import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotesModule from '../NotesModule';

const mockUseStore = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: (...args: unknown[]) => mockUseStore(...args),
}));

function buildState(overrides: Record<string, unknown> = {}) {
    return {
        notes: [],
        selectedNoteId: null,
        addNote: vi.fn(),
        updateNote: vi.fn(),
        deleteNote: vi.fn(),
        setSelectedNote: vi.fn(),
        user: null,
        ...overrides,
    };
}

describe('NotesModule', () => {
    beforeEach(() => {
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState())
        );
    });

    it('shows that notes stay local until sign-in', () => {
        render(<NotesModule />);

        expect(screen.getByText('Saved on this device only until you sign in')).toBeInTheDocument();
    });

    it('shows that signed-in notes are synced to the workspace', () => {
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ user: { uid: 'user-123' } }))
        );

        render(<NotesModule />);

        expect(screen.getByText('Saved locally and synced to your workspace')).toBeInTheDocument();
    });
});
