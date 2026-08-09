import { z } from 'zod';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';

export const SetlistCategorySchema = z.enum(['original', 'dj', 'cover', 'unclassified']);
export const SetlistTrackTypeSchema = z.enum(['original', 'remix', 'cover', 'other']);

export const SetlistTrackDraftSchema = z.object({
    id: z.string().min(1).max(80),
    title: z.string().trim().min(1).max(300),
    originalArtist: z.string().trim().max(300).default(''),
    type: SetlistTrackTypeSchema,
});

export const SetlistDraftInputSchema = z.object({
    userId: z.string().min(1).max(128),
    venue: z.string().trim().min(1).max(300),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    city: z.string().trim().max(200).default(''),
    attendance: z.number().int().min(0).max(1_000_000).default(0),
    songs: z.array(SetlistTrackDraftSchema).min(1).max(200),
    category: SetlistCategorySchema,
});

export type SetlistCategory = 'original' | 'dj' | 'cover' | 'unclassified';
export type SetlistTrackType = 'original' | 'remix' | 'cover' | 'other';
export interface SetlistTrackDraft {
    id: string;
    title: string;
    originalArtist: string;
    type: SetlistTrackType;
}
export interface SetlistDraftInput {
    userId: string;
    venue: string;
    date: string;
    city: string;
    attendance: number;
    songs: SetlistTrackDraft[];
    category: SetlistCategory;
}
export type SetlistDraft = SetlistDraftInput & {
    id: string;
    status: 'draft_requires_manual_filing';
};

const PersistedSetlistDraftSchema = SetlistDraftInputSchema.extend({
    status: z.literal('draft_requires_manual_filing'),
});

const setlistsCollection = (userId: string) => collection(db, `users/${userId}/setlists`);

export const setlistDraftService = {
    subscribe(
        userId: string,
        onData: (drafts: SetlistDraft[]) => void,
        onError: (error: Error) => void,
    ): () => void {
        const draftsQuery = query(setlistsCollection(userId), orderBy('createdAt', 'desc'));
        return onSnapshot(draftsQuery, {
            next: (snapshot) => {
                const drafts = snapshot.docs.flatMap(snapshotDoc => {
                    const parsed = PersistedSetlistDraftSchema.safeParse(snapshotDoc.data());
                    if (!parsed.success) {
                        logger.warn(`[SetlistDraftService] Skipping invalid draft ${snapshotDoc.id}:`, parsed.error);
                        return [];
                    }
                    return [{ id: snapshotDoc.id, ...parsed.data } as SetlistDraft];
                });
                onData(drafts);
            },
            error: onError,
        });
    },

    async create(input: SetlistDraftInput): Promise<string> {
        const validated = SetlistDraftInputSchema.parse(input) as SetlistDraftInput;
        const draftRef = doc(setlistsCollection(validated.userId));
        await setDoc(draftRef, {
            ...validated,
            status: 'draft_requires_manual_filing',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return draftRef.id;
    },

    async delete(userId: string, draftId: string): Promise<void> {
        if (!userId || !draftId) throw new Error('A user ID and draft ID are required.');
        await deleteDoc(doc(db, `users/${userId}/setlists`, draftId));
    },
};
