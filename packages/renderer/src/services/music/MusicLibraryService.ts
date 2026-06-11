import { db, auth } from '@/services/firebase';
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import type { AudioFeatures, AudioSemanticData } from '@/services/audio/types';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export interface AnalyzedTrack {
    id: string; // Typically a hash of the file or consistent local ID
    userId: string;
    filename: string;
    features: AudioFeatures;
    semantic?: AudioSemanticData; // Optional semantic data from Gemini
    analyzedAt: string; // ISO string
    fileHash?: string; // Optional hash for de-duplication
    proxyBase64?: string; // FFmpeg generated base64 encoded mp3
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
        fileHash?: string,
        semantic?: AudioSemanticData
    ): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const data: Partial<AnalyzedTrack> = {
            id: trackId,
            userId,
            filename,
            features,
            analyzedAt: new Date().toISOString(),
        };
        if (semantic !== undefined) data.semantic = semantic;
        if (fileHash !== undefined) data.fileHash = fileHash;

        try {
            if (isFirebaseE2EMockEnabled()) {
                const mockKey = `E2E_MOCK_MUSIC_${userId}_${trackId}`;
                localStorage.setItem(mockKey, JSON.stringify(data));
                logger.info(`[MusicLibrary] 🧪 E2E Mock: Saved analysis for track: ${filename} (${trackId})`);
                return;
            }

            const trackRef = doc(db, this.COLLECTION, userId, 'analyzed_tracks', trackId);
            await setDoc(trackRef, data, { merge: true });
            logger.info(`[MusicLibrary] Saved analysis for track: ${filename} (${trackId})`);
        } catch (error: unknown) {
            logger.error(`[MusicLibrary] Failed to save analysis for ${trackId}:`, error);
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
            if (isFirebaseE2EMockEnabled()) {
                const mockKey = `E2E_MOCK_MUSIC_${userId}_${trackId}`;
                const stored = localStorage.getItem(mockKey);
                if (stored) {
                    logger.info(`[MusicLibrary] 🧪 E2E Mock: Cache hit for track: ${trackId}`);
                    return JSON.parse(stored) as AnalyzedTrack;
                }
                return null;
            }

            const snap = await getDoc(trackRef);
            if (snap.exists()) {
                logger.info(`[MusicLibrary] Cache hit for track: ${trackId}`);
                return snap.data() as AnalyzedTrack;
            }
        } catch (error: unknown) {
            logger.error(`[MusicLibrary] Error fetching analysis for ${trackId}:`, error);
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
            if (isFirebaseE2EMockEnabled()) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith(`E2E_MOCK_MUSIC_${userId}_`)) {
                        const val = localStorage.getItem(key);
                        if (val) {
                            const track = JSON.parse(val) as AnalyzedTrack;
                            if (track.fileHash === fileHash) {
                                logger.info(`[MusicLibrary] 🧪 E2E Mock: Cache hit by hash: ${fileHash}`);
                                return track;
                            }
                        }
                    }
                }
                return null;
            }

            const snap = await getDocs(q);
            if (!snap.empty) {
                logger.info(`[MusicLibrary] Cache hit by hash: ${fileHash}`);
                return snap.docs[0]!.data() as AnalyzedTrack;
            }
        } catch (error: unknown) {
            logger.error(`[MusicLibrary] Error fetching analysis by hash:`, error);
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
            if (isFirebaseE2EMockEnabled()) {
                const tracks: AnalyzedTrack[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith(`E2E_MOCK_MUSIC_${userId}_`)) {
                        const val = localStorage.getItem(key);
                        if (val) tracks.push(JSON.parse(val));
                    }
                }
                logger.info(`[MusicLibrary] 🧪 E2E Mock: Found ${tracks.length} analyzed tracks.`);
                return tracks;
            }

            logger.info(`[MusicLibrary] Listing library for user: ${userId}`);
            const snap = await getDocs(tracksRef);
            const tracks = snap.docs.map(doc => doc.data() as AnalyzedTrack);
            logger.info(`[MusicLibrary] Found ${tracks.length} analyzed tracks.`);
            return tracks;
        } catch (error: unknown) {
            logger.error(`[MusicLibrary] Error listing library:`, error);
            return [];
        }
    }
}

export const musicLibraryService = new MusicLibraryService();
