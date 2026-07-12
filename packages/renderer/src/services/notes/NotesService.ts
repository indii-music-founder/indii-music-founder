/**
 * NotesService — Firestore-backed cross-device note persistence
 *
 * Replaces localStorage-only storage with cloud-synced durability.
 * Provides:
 *   - Push: debounced writes to Firestore
 *   - Pull: one-shot read of all notes
 *   - Subscribe: real-time listener (Phase 2)
 *   - Offline queue: persist failed writes for retry
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
    updatedAt?: number; // Firestore server timestamp
}

class NotesServiceImpl {
    private pendingWrites: Map<string, Note> = new Map();
    private isRetrying = false;

    /**
     * Push a single note to Firestore (debounced).
     * If write fails, queues for retry on reconnect.
     */
    async pushNote(note: Note): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot push note: not authenticated');
            return;
        }

        try {
            const docRef = doc(db, 'users', userId, 'notes', note.id);
            await setDoc(docRef, {
                ...note,
                userId,
                updatedAt: serverTimestamp(),
            });

            // Remove from retry queue on success
            this.pendingWrites.delete(note.id);
        } catch (error) {
            logger.warn('[NotesService] Push failed, queuing for retry:', error);
            this.pendingWrites.set(note.id, note);
            this.scheduleRetry();
        }
    }

    /**
     * Push all notes to Firestore (used for bulk sync).
     * Batches writes to respect Firestore limits.
     */
    async pushAllNotes(notes: Note[]): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot push notes: not authenticated');
            return;
        }

        const batch = writeBatch(db);
        notes.forEach(note => {
            const docRef = doc(db, 'users', userId, 'notes', note.id);
            batch.set(docRef, {
                ...note,
                userId,
                updatedAt: serverTimestamp(),
            });
        });

        try {
            await batch.commit();
            logger.info(`[NotesService] Pushed ${notes.length} notes to Firestore`);
            // Clear pending writes on success
            notes.forEach(n => this.pendingWrites.delete(n.id));
        } catch (error) {
            logger.error('[NotesService] Bulk push failed:', error);
            notes.forEach(n => this.pendingWrites.set(n.id, n));
            this.scheduleRetry();
        }
    }

    /**
     * Pull all notes from Firestore (one-shot read).
     */
    async pullNotes(): Promise<Note[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot pull notes: not authenticated');
            return [];
        }

        try {
            const constraints: QueryConstraint[] = [
                where('userId', '==', userId),
            ];

            const q = query(collection(db, 'users', userId, 'notes'), ...constraints);
            const snapshot = await getDocs(q);

            const notes: Note[] = snapshot.docs.map(doc => {
                const data = doc.data() as FirestoreNote;
                return {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    attachments: data.attachments || [],
                    tags: data.tags || [],
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
            });

            logger.info(`[NotesService] Pulled ${notes.length} notes from Firestore`);
            return notes;
        } catch (error) {
            logger.error('[NotesService] Pull failed:', error);
            return [];
        }
    }

    /**
     * Delete a note from Firestore.
     */
    async deleteNote(noteId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot delete note: not authenticated');
            return;
        }

        try {
            const docRef = doc(db, 'users', userId, 'notes', noteId);
            await deleteDoc(docRef);
            this.pendingWrites.delete(noteId);
        } catch (error) {
            logger.warn('[NotesService] Delete failed, queuing for retry:', error);
            this.pendingWrites.set(noteId, { id: noteId } as Note);
            this.scheduleRetry();
        }
    }

    /**
     * Subscribe to real-time note updates (Phase 2).
     * Returns unsubscribe function.
     */
    subscribe(callback: (notes: Note[]) => void): Unsubscribe {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logger.warn('[NotesService] Cannot subscribe: not authenticated');
            return () => { };
        }

        const constraints: QueryConstraint[] = [
            where('userId', '==', userId),
        ];

        const q = query(collection(db, 'users', userId, 'notes'), ...constraints);

        return onSnapshot(q, (snapshot) => {
            const notes: Note[] = snapshot.docs.map(doc => {
                const data = doc.data() as FirestoreNote;
                return {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    attachments: data.attachments || [],
                    tags: data.tags || [],
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
            });
            callback(notes);
        }, (error) => {
            logger.error('[NotesService] Subscription error:', error);
        });
    }

    /**
     * Retry pending writes (called on reconnect or after timeout).
     */
    private scheduleRetry(): void {
        if (this.isRetrying || this.pendingWrites.size === 0) return;

        this.isRetrying = true;
        const retryDelay = 2000; // 2 second retry

        setTimeout(async () => {
            if (this.pendingWrites.size === 0) {
                this.isRetrying = false;
                return;
            }

            const toRetry = Array.from(this.pendingWrites.values());
            logger.info(`[NotesService] Retrying ${toRetry.length} pending writes...`);

            try {
                await this.pushAllNotes(toRetry);
                this.isRetrying = false;
            } catch (error) {
                logger.warn('[NotesService] Retry failed, will try again:', error);
                this.isRetrying = false;
                // Reschedule if still pending
                if (this.pendingWrites.size > 0) {
                    this.scheduleRetry();
                }
            }
        }, retryDelay);
    }

    /**
     * Check if there are pending writes (for UI feedback).
     */
    hasPendingWrites(): boolean {
        return this.pendingWrites.size > 0;
    }

    /**
     * Get count of pending writes.
     */
    getPendingWriteCount(): number {
        return this.pendingWrites.size;
    }
}

export const notesService = new NotesServiceImpl();
