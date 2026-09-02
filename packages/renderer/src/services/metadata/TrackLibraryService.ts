import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    type FirestoreError,
    type QueryConstraint,
    type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '@/services/firebase';
import type { ExtendedGoldenMetadata } from './types';

export class TrackLibraryService {
    private requireUserId(): string {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('An authenticated user is required to access the track library.');
        }
        return userId;
    }

    async getByFingerprint(fingerprint: string): Promise<ExtendedGoldenMetadata | null> {
        const userId = this.requireUserId();
        const snapshot = await getDoc(doc(db, 'users', userId, 'tracks', fingerprint));
        if (!snapshot.exists()) return null;

        return {
            id: snapshot.id,
            ...snapshot.data(),
        } as ExtendedGoldenMetadata;
    }

    async list(constraints: QueryConstraint[] = []): Promise<ExtendedGoldenMetadata[]> {
        const userId = this.requireUserId();
        const snapshot = await getDocs(query(
            collection(db, 'users', userId, 'tracks'),
            ...constraints
        ));

        return snapshot.docs.map(track => ({
            id: track.id,
            ...track.data(),
        } as ExtendedGoldenMetadata));
    }

    async saveTrack(metadata: ExtendedGoldenMetadata): Promise<void> {
        if (!metadata.masterFingerprint) {
            throw new Error('Cannot save track without a master fingerprint');
        }

        const userId = this.requireUserId();
        if (metadata.userId && metadata.userId !== userId) {
            throw new Error('Track ownership does not match the authenticated user.');
        }

        await setDoc(
            doc(db, 'users', userId, 'tracks', metadata.masterFingerprint),
            this.pruneUndefined({
                ...metadata,
                userId,
                updatedAt: Timestamp.now(),
            }),
            { merge: true }
        );
    }

    subscribeTracks(
        onUpdate: (tracks: (ExtendedGoldenMetadata & { _hasPendingWrites?: boolean; _isFromCache?: boolean })[]) => void,
        onError?: (error: FirestoreError) => void,
        constraints: QueryConstraint[] = []
    ): Unsubscribe {
        const userId = this.requireUserId();
        const q = query(collection(db, 'users', userId, 'tracks'), ...constraints);

        return onSnapshot(
            q,
            { includeMetadataChanges: true },
            snapshot => {
                const tracks = snapshot.docs.map(trackDoc => ({
                    id: trackDoc.id,
                    ...trackDoc.data(),
                    _hasPendingWrites: trackDoc.metadata.hasPendingWrites,
                    _isFromCache: trackDoc.metadata.fromCache,
                } as ExtendedGoldenMetadata & { _hasPendingWrites?: boolean; _isFromCache?: boolean }));
                onUpdate(tracks);
            },
            onError
        );
    }

    subscribeTrack(
        fingerprint: string,
        onUpdate: (track: (ExtendedGoldenMetadata & { _hasPendingWrites?: boolean; _isFromCache?: boolean }) | null) => void,
        onError?: (error: FirestoreError) => void
    ): Unsubscribe {
        const userId = this.requireUserId();
        const docRef = doc(db, 'users', userId, 'tracks', fingerprint);

        return onSnapshot(
            docRef,
            { includeMetadataChanges: true },
            snapshot => {
                if (!snapshot.exists()) {
                    onUpdate(null);
                    return;
                }
                const track = {
                    id: snapshot.id,
                    ...snapshot.data(),
                    _hasPendingWrites: snapshot.metadata.hasPendingWrites,
                    _isFromCache: snapshot.metadata.fromCache,
                } as ExtendedGoldenMetadata & { _hasPendingWrites?: boolean; _isFromCache?: boolean };
                onUpdate(track);
            },
            onError
        );
    }

    async deleteTrack(fingerprint: string): Promise<void> {
        const userId = this.requireUserId();
        await deleteDoc(doc(db, 'users', userId, 'tracks', fingerprint));
    }

    private pruneUndefined(value: unknown): unknown {
        if (value === null || typeof value !== 'object' || value instanceof Timestamp) return value;
        if (Array.isArray(value)) return value.map(item => this.pruneUndefined(item));

        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .map(([key, entry]) => [key, this.pruneUndefined(entry)])
        );
    }
}

export const trackLibrary = new TrackLibraryService();
