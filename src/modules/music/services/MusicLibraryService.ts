import { collection, doc, getDoc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { AudioFeatures } from '@/services/audio/AudioAnalysisService';

export interface PersistedTrackAnalysis {
    id: string; // Hash of file content or path
    filePath: string;
    fileName: string;
    features: AudioFeatures;
    fingerprint?: string;
    generatedTags?: string[];
    updatedAt: any;
}

export class MusicLibraryService {
    private static COLLECTION_NAME = 'music_library';

    private static getUserCollection() {
        if (!auth.currentUser) throw new Error("User not authenticated");
        return collection(db, 'users', auth.currentUser.uid, this.COLLECTION_NAME);
    }

    /**
     * Generate a simple hash from file metadata + name to handle re-imports of same file
     */
    static generateTrackHash(file: File): string {
        return `${file.name}-${file.size}-${file.lastModified}`;
    }

    static async getTrackAnalysis(file: File): Promise<PersistedTrackAnalysis | null> {
        try {
            if (!auth.currentUser) return null;
            const hash = this.generateTrackHash(file);
            const docRef = doc(this.getUserCollection(), hash);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                return snap.data() as PersistedTrackAnalysis;
            }
        } catch (error) {
            console.warn("Failed to fetch track analysis:", error);
        }
        return null;
    }

    static async saveTrackAnalysis(file: File, features: AudioFeatures, fingerprint?: string): Promise<void> {
        if (!auth.currentUser) return;

        const hash = this.generateTrackHash(file);
        const data: PersistedTrackAnalysis = {
            id: hash,
            filePath: (file as any).path || file.name, // Electron 'path' vs Web 'name'
            fileName: file.name,
            features,
            fingerprint,
            updatedAt: serverTimestamp()
        };

        try {
            const docRef = doc(this.getUserCollection(), hash);
            await setDoc(docRef, data, { merge: true });
            console.log(`[MusicLibrary] Saved analysis for ${file.name}`);
        } catch (error) {
            console.error("Failed to save track analysis:", error);
        }
    }
}
