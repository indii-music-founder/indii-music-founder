
import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    Timestamp,
    setDoc
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { Track, Playlist, TrackStatus } from '@/modules/music/types';

export class MusicService {

    /**
     * Add a new track
     */
    static async addTrack(data: Omit<Track, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const trackData = {
            ...data,
            userId: userProfile.id,
            status: data.status || TrackStatus.DEMO,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'users', userProfile.id, 'tracks'), trackData);
        return docRef.id;
    }

    /**
     * Get all tracks for user
     */
    static async getTracks(): Promise<Track[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const q = query(
            collection(db, 'users', userProfile.id, 'tracks'),
            orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as Track));
    }

    /**
     * Update track
     */
    static async updateTrack(id: string, updates: Partial<Track>): Promise<void> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const docRef = doc(db, 'users', userProfile.id, 'tracks', id);

        // Sanitize
        const { id: _, userId: __, createdAt: ___, ...cleanUpdates } = updates as any;

        await updateDoc(docRef, {
            ...cleanUpdates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Delete track
     */
    static async deleteTrack(id: string): Promise<void> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        await deleteDoc(doc(db, 'users', userProfile.id, 'tracks', id));
    }

    /**
     * Create Playlist
     */
    static async createPlaylist(data: Omit<Playlist, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const playlistData = {
            ...data,
            userId: userProfile.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'users', userProfile.id, 'playlists'), playlistData);
        return docRef.id;
    }
}
