import { StateCreator } from 'zustand';
import { StoreState } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { useStore } from '../index';

export interface Note {
    id: string;
    title: string;
    content: string;
    attachments: string[]; // URLs to images/files
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface NotesSlice {
    notes: Note[];
    selectedNoteId: string | null;
    notesLoading: boolean;
    notesSyncError: string | null;

    // Actions
    addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
    updateNote: (id: string, updates: Partial<Note>) => void;
    deleteNote: (id: string) => void;
    setSelectedNote: (id: string | null) => void;
    addAttachmentToNote: (id: string, url: string) => void;
    loadNotesFromCloud: () => Promise<void>;
}

export const createNotesSlice: StateCreator<StoreState, [], [], NotesSlice> = (set) => ({
    notes: [],
    selectedNoteId: null,
    notesLoading: false,
    notesSyncError: null,

    addNote: (noteData) => {
        const id = uuidv4();
        const now = Date.now();
        const newNote: Note = {
            ...noteData,
            id,
            createdAt: now,
            updatedAt: now,
        };

        set((state) => ({
            notes: [newNote, ...state.notes]
        }));

        // Sync to Firestore (fire-and-forget, but with retry queue)
        import('@/services/notes/NotesService').then(({ notesService }) => {
            notesService.pushNote(newNote).catch(e =>
                logger.error('[NotesSlice] Failed to push new note:', e)
            );
        });

        return id;
    },

    updateNote: (id, updates) => {
        set((state) => {
            const updatedNote = state.notes.find(n => n.id === id);
            if (!updatedNote) return {};

            const updated = { ...updatedNote, ...updates, updatedAt: Date.now() };
            return {
                notes: state.notes.map(note =>
                    note.id === id ? updated : note
                )
            };
        });

        // Sync to Firestore
        const updatedNote = useStore.getState().notes.find((n: Note) => n.id === id);
        if (updatedNote) {
            import('@/services/notes/NotesService').then(({ notesService }) => {
                notesService.pushNote(updatedNote).catch(e =>
                    logger.error('[NotesSlice] Failed to push updated note:', e)
                );
            });
        }
    },

    deleteNote: (id) => {
        set((state) => ({
            notes: state.notes.filter(note => note.id !== id),
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
        }));

        // Delete from Firestore
        import('@/services/notes/NotesService').then(({ notesService }) => {
            notesService.deleteNote(id).catch(e =>
                logger.error('[NotesSlice] Failed to delete note:', e)
            );
        });
    },

    setSelectedNote: (id) => {
        set({ selectedNoteId: id });
    },

    addAttachmentToNote: (id, url) => {
        set((state) => {
            const updated = state.notes.map(note =>
                note.id === id
                    ? { ...note, attachments: [...note.attachments, url], updatedAt: Date.now() }
                    : note
            );
            return { notes: updated };
        });

        // Sync to Firestore
        const updatedNote = useStore.getState().notes.find((n: Note) => n.id === id);
        if (updatedNote) {
            import('@/services/notes/NotesService').then(({ notesService }) => {
                notesService.pushNote(updatedNote).catch(e =>
                    logger.error('[NotesSlice] Failed to push attachment:', e)
                );
            });
        }
    },

    loadNotesFromCloud: async () => {
        set({ notesLoading: true, notesSyncError: null });
        try {
            const { notesService } = await import('@/services/notes/NotesService');
            const cloudNotes = await notesService.pullNotes();
            // Merge rather than overwrite: a note created locally in the brief window
            // before this cloud pull resolves (e.g. right at app boot) hasn't synced yet
            // and wouldn't be in cloudNotes — replacing wholesale would make it vanish
            // from the UI even though it's about to be pushed successfully.
            set((state) => {
                const cloudIds = new Set(cloudNotes.map(n => n.id));
                const localOnly = state.notes.filter(n => !cloudIds.has(n.id));
                return { notes: [...localOnly, ...cloudNotes], notesLoading: false };
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to load notes';
            logger.error('[NotesSlice] Load notes failed:', error);
            set({ notesLoading: false, notesSyncError: errorMsg });
        }
    }
});
