/**
 * NotesService — Firestore-backed cross-device note persistence.
 *
 * Firestore owns offline persistence and retry semantics. This service reports
 * failures to callers instead of maintaining a second in-memory queue that can
 * lose operations or confuse a failed delete with a write.
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
    type QueryConstraint,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { Note } from '@/core/store/slices/notesSlice';

interface FirestoreNote extends Omit<Note, 'updatedAt'> {
    userId: string;
    updatedAt?: number | { toMillis(): number };
}

function timestampToMillis(value: FirestoreNote['updatedAt'], fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'object' && value !== null && typeof value.toMillis === 'function') {
        return value.toMillis();
    }
    return fallback;
}

function deserializeNote(document: { id: string; data(): unknown }): Note {
    const data = document.data() as FirestoreNote;
    return {
        id: document.id,
        title: data.title,
        content: data.content,
        attachments: data.attachments || [],
        tags: data.tags || [],
        createdAt: data.createdAt,
        updatedAt: timestampToMillis(data.updatedAt, data.createdAt),
    };
}

class NotesServiceImpl {
    async pushNote(note: Note): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in is required to sync notes.');

        try {
            await setDoc(doc(db, 'users', userId, 'notes', note.id), {
                ...note,
                userId,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            logger.error('[NotesService] Push failed:', error);
            throw error;
        }
    }

    async pushAllNotes(notes: Note[]): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in is required to sync notes.');

        const batch = writeBatch(db);
        notes.forEach(note => {
            batch.set(doc(db, 'users', userId, 'notes', note.id), {
                ...note,
                userId,
                updatedAt: serverTimestamp(),
            });
        });

        try {
            await batch.commit();
            logger.info(`[NotesService] Pushed ${notes.length} notes to Firestore`);
        } catch (error) {
            logger.error('[NotesService] Bulk push failed:', error);
            throw error;
        }
    }

    async pullNotes(): Promise<Note[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in is required to sync notes.');

        try {
            const constraints: QueryConstraint[] = [where('userId', '==', userId)];
            const snapshot = await getDocs(query(collection(db, 'users', userId, 'notes'), ...constraints));
            const notes = snapshot.docs.map(deserializeNote);
            logger.info(`[NotesService] Pulled ${notes.length} notes from Firestore`);
            return notes;
        } catch (error) {
            logger.error('[NotesService] Pull failed:', error);
            throw error;
        }
    }

    async deleteNote(noteId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in is required to sync notes.');

        try {
            await deleteDoc(doc(db, 'users', userId, 'notes', noteId));
        } catch (error) {
            logger.error('[NotesService] Delete failed:', error);
            throw error;
        }
    }

    subscribe(callback: (notes: Note[]) => void): Unsubscribe {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot subscribe: not authenticated');
            return () => { };
        }

        const constraints: QueryConstraint[] = [where('userId', '==', userId)];
        const notesQuery = query(collection(db, 'users', userId, 'notes'), ...constraints);

        return onSnapshot(notesQuery, snapshot => {
            callback(snapshot.docs.map(deserializeNote));
        }, error => {
            logger.error('[NotesService] Subscription error:', error);
        });
    }
}

export const notesService = new NotesServiceImpl();
