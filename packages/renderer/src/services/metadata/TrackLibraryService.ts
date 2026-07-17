import {
    Timestamp,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    type QueryConstraint,
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
