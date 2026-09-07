import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickNotesDrawer } from '../QuickNotesDrawer';
import type { Note } from '@/core/store/slices/notesSlice';

const mockUseStore = vi.fn();
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
};

vi.mock('@/core/store', () => ({
    useStore: (...args: unknown[]) => mockUseStore(...args),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

function buildState(overrides: Record<string, unknown> = {}) {
    const sampleNote: Note = {
        id: 'note-1',
        title: 'Song Hook Ideas',
        content: 'Velvet voltage in the dark',
        attachments: [],
        tags: ['quick-capture'],
        createdAt: 1000,
        updatedAt: 1000,
    };

    return {
        notes: [sampleNote],
        notesLoading: false,
        selectedNoteId: 'note-1',
        addNote: vi.fn().mockReturnValue('note-2'),
        updateNote: vi.fn(),
        deleteNote: vi.fn(),
        setSelectedNote: vi.fn(),
        setModule: vi.fn(),
        currentProjectId: 'proj-123',
        addCanvasBlock: vi.fn(),
        ...overrides,
    };
}

describe('QuickNotesDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState())
        );
    });

    it('does not render when isOpen is false', () => {
        render(<QuickNotesDrawer isOpen={false} onClose={vi.fn()} />);
        expect(screen.queryByRole('dialog', { name: /quick notes drawer/i })).not.toBeInTheDocument();
    });

    it('renders drawer and active note fields when isOpen is true', () => {
        render(<QuickNotesDrawer isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('dialog', { name: /quick notes drawer/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Note title...')).toHaveValue('Song Hook Ideas');
        expect(screen.getByPlaceholderText(/Jot down lyrics/i)).toHaveValue('Velvet voltage in the dark');
    });

    it('calls updateNote when title or content changes', () => {
        const updateNote = vi.fn();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ updateNote }))
        );

        render(<QuickNotesDrawer isOpen={true} onClose={vi.fn()} />);

        const titleInput = screen.getByPlaceholderText('Note title...');
        fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
        expect(updateNote).toHaveBeenCalledWith('note-1', { title: 'Updated Title' });

        const contentInput = screen.getByPlaceholderText(/Jot down lyrics/i);
        fireEvent.change(contentInput, { target: { value: 'New lyrics line' } });
        expect(updateNote).toHaveBeenCalledWith('note-1', { content: 'New lyrics line' });
    });

    it('calls addCanvasBlock when Pin to Current Canvas is clicked', () => {
        const addCanvasBlock = vi.fn();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ addCanvasBlock }))
        );

        render(<QuickNotesDrawer isOpen={true} onClose={vi.fn()} />);

        const pinBtn = screen.getByText('Pin to Current Canvas');
        fireEvent.click(pinBtn);

        expect(addCanvasBlock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'note',
            entityRef: expect.objectContaining({
                kind: 'note',
                entityId: 'note-1',
                projectId: 'proj-123',
            }),
        }));
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('pinned to Project Canvas'));
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<QuickNotesDrawer isOpen={true} onClose={onClose} />);

        const closeBtn = screen.getByRole('button', { name: /close drawer/i });
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalled();
    });

    it('creates new note when plus button is clicked', () => {
        const addNote = vi.fn().mockReturnValue('new-note-id');
        const setSelectedNote = vi.fn();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ addNote, setSelectedNote }))
        );

        render(<QuickNotesDrawer isOpen={true} onClose={vi.fn()} />);

        const newNoteBtn = screen.getByRole('button', { name: /create new note/i });
        fireEvent.click(newNoteBtn);

        expect(addNote).toHaveBeenCalledWith(expect.objectContaining({
            title: 'New Idea',
            tags: ['quick-capture'],
        }));
        expect(setSelectedNote).toHaveBeenCalledWith('new-note-id');
    });

    it('handles empty notes array without crashing', () => {
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ notes: [], selectedNoteId: null }))
        );

        render(<QuickNotesDrawer isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('dialog', { name: /quick notes drawer/i })).toBeInTheDocument();
        expect(screen.getByText('Recent Notes (0)')).toBeInTheDocument();
    });
});
