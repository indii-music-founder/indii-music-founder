import { db, auth } from '@/services/firebase';
import { collection, doc, setDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { AudioFeatures } from '@/services/audio/AudioAnalysisService';

export interface AnalyzedTrack {
    id: string; // Typically a hash of the file or consistent local ID
    userId: string;
    filename: string;
    features: AudioFeatures;
    analyzedAt: string; // ISO string
    fileHash?: string; // Optional hash for de-duplication
}

export class MusicLibraryService {
    private readonly COLLECTION = 'users'; // We nest under users/{userId}/analyzed_tracks

    /**
     * Saves audio analysis results to Firestore.
     */
    async saveAnalysis(
        trackId: string,
        filename: string,
        features: AudioFeatures,
        fileHash?: string
    ): Promise<void> {
        if (!auth.currentUser) return;

        const userId = auth.currentUser.uid;
        const trackRef = doc(db, this.COLLECTION, userId, 'analyzed_tracks', trackId);

        const data: AnalyzedTrack = {
            id: trackId,
            userId,
            filename,
            features,
            analyzedAt: new Date().toISOString(),
            fileHash
        };

        try {
            await setDoc(trackRef, data, { merge: true });
            console.info(`[MusicLibrary] Saved analysis for track: ${filename} (${trackId})`);
        } catch (error) {
            console.error(`[MusicLibrary] Failed to save analysis for ${trackId}:`, error);
            // Non-blocking error, analysis is just lost from cache
        }
    }

    /**
     * Retrieves cached analysis if available.
     */
    async getAnalysis(trackId: string): Promise<AnalyzedTrack | null> {
        if (!auth.currentUser) return null;

        const userId = auth.currentUser.uid;
        const trackRef = doc(db, this.COLLECTION, userId, 'analyzed_tracks', trackId);

        try {
            const snap = await getDoc(trackRef);
            if (snap.exists()) {
                console.info(`[MusicLibrary] Cache hit for track: ${trackId}`);
                return snap.data() as AnalyzedTrack;
            }
        } catch (error) {
            console.error(`[MusicLibrary] Error fetching analysis for ${trackId}:`, error);
        }

        return null;
    }

    /**
     * Retrieves cached analysis by file hash (for de-duplication).
     */
    async getAnalysisByHash(fileHash: string): Promise<AnalyzedTrack | null> {
        if (!auth.currentUser) return null;

        const userId = auth.currentUser.uid;
        const tracksRef = collection(db, this.COLLECTION, userId, 'analyzed_tracks');
        const q = query(tracksRef, where('fileHash', '==', fileHash));

        try {
            const snap = await getDocs(q);
            if (!snap.empty) {
                console.info(`[MusicLibrary] Cache hit by hash: ${fileHash}`);
                return snap.docs[0].data() as AnalyzedTrack;
            }
        } catch (error) {
            console.error(`[MusicLibrary] Error fetching analysis by hash:`, error);
        }

        return null;
    }

    /**
     * Lists all analyzed tracks for the current user.
     */
    async listLibrary(): Promise<AnalyzedTrack[]> {
        if (!auth.currentUser) return [];

        const userId = auth.currentUser.uid;
        const tracksRef = collection(db, this.COLLECTION, userId, 'analyzed_tracks');

        try {
            const snap = await getDocs(tracksRef);
            return snap.docs.map(doc => doc.data() as AnalyzedTrack);
        } catch (error) {
            console.error(`[MusicLibrary] Error listing library:`, error);
            return [];
        }
    }
}

export const musicLibraryService = new MusicLibraryService();
