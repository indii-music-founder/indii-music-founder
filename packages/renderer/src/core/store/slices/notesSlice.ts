import { StateCreator } from 'zustand';
import { StoreState } from '../index';
import { v4 as uuidv4 } from 'uuid';

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

    // Actions
    addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
    updateNote: (id: string, updates: Partial<Note>) => void;
    deleteNote: (id: string) => void;
    setSelectedNote: (id: string | null) => void;
    addAttachmentToNote: (id: string, url: string) => void;
}

export const createNotesSlice: StateCreator<StoreState, [], [], NotesSlice> = (set) => ({
    notes: [],
    selectedNoteId: null,

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

        return id;
    },

    updateNote: (id, updates) => {
        set((state) => ({
            notes: state.notes.map(note =>
                note.id === id
                    ? { ...note, ...updates, updatedAt: Date.now() }
                    : note
            )
        }));
    },

    deleteNote: (id) => {
        set((state) => ({
            notes: state.notes.filter(note => note.id !== id),
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
        }));
    },

    setSelectedNote: (id) => {
        set({ selectedNoteId: id });
    },

    addAttachmentToNote: (id, url) => {
        set((state) => ({
            notes: state.notes.map(note =>
                note.id === id
                    ? { ...note, attachments: [...note.attachments, url], updatedAt: Date.now() }
                    : note
            )
        }));
    }
});
